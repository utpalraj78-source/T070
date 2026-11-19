const S = {
  token: sessionStorage.getItem("hsts_token"),
  user: null,
  view: "dashboard",
  record: null,
  master: {},
  filters: {},
};
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
function notice(msg, bad = false) {
  let t = $("#toast");
  t.textContent = msg;
  t.style.background = bad ? "#a12b2b" : "#163c68";
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 4000);
}
async function api(path, method = "GET", body) {
  const r = await fetch("/api" + path, {
    method,
    headers: {
      ...(S.token ? { Authorization: "Bearer " + S.token } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await r.json();
  } catch {}
  if (!r.ok) {
    if (r.status === 401 && path != "/auth/login") {
      S.token = null;
      sessionStorage.removeItem("hsts_token");
      S.user = null;
      renderLogin();
    }
    throw new Error(data?.error?.message || "Request failed");
  }
  return data;
}
function busy(form, on) {
  form.querySelectorAll("button").forEach((b) => (b.disabled = on));
}
function formData(form) {
  return Object.fromEntries(new FormData(form));
}
function action(form, fn) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    busy(form, true);
    try {
      await fn(formData(form));
      notice("Saved successfully.");
    } catch (err) {
      notice(err.message, true);
    } finally {
      busy(form, false);
    }
  });
}
function page(title, sub, body) {
  $("#main").innerHTML =
    `<h1>${esc(title)}</h1><p class="sub">${esc(sub)}</p>${body}`;
}
function nav() {
  if (!S.user) {
    $("#nav").innerHTML = "";
    $("#account").innerHTML = "";
    return;
  }
  let role = S.user.role;
  let items = [
    ["dashboard", "Dashboard"],
    ["profile", "Profile"],
    [
      "records",
      role === "Student/Alumni" ? "Higher-Study Profile" : "Search Records",
    ],
  ];
  if (role === "Student/Alumni")
    items.push(
      ["add", "Add Higher-Study Record"],
      ["notifications", "Notifications"],
    );
  if (role === "Higher Studies Coordinator")
    items.push(["queue", "Verification Queue"], ["reports", "Reports"]);
  if (role === "Administrator")
    items.push(
      ["users", "User Management"],
      ["countries", "Countries"],
      ["institutions", "Institutions"],
      ["programmes", "Programmes"],
      ["reports", "Reports"],
      ["audit", "Audit"],
    );
  $("#nav").innerHTML = items
    .map(
      ([id, label]) =>
        `<button data-view="${id}" class="${S.view === id ? "active" : ""}">${label}</button>`,
    )
    .join("");
  $("#nav")
    .querySelectorAll("button")
    .forEach((b) => (b.onclick = () => show(b.dataset.view)));
  $("#account").innerHTML =
    `${esc(S.user.name)} <button id="logout">Log out</button>`;
  $("#logout").onclick = logout;
}
async function logout() {
  try {
    await api("/auth/logout", "POST");
  } catch {}
  sessionStorage.removeItem("hsts_token");
  S.token = null;
  S.user = null;
  renderLogin();
}
function renderLogin() {
  nav();
  $("#main").innerHTML =
    `<section class="card login"><h1>Sign in</h1><p class="sub"></p><form id="login"><label for="email">Email (@lnmiit.ac.in) *</label><input id="email" name="email" type="email" placeholder="e.g. 24ucs144@lnmiit.ac.in" required autocomplete="username"><label for="password">Password *</label><input id="password" name="password" type="password" required autocomplete="current-password"><div class="actions"><button>Sign in</button></div></form><p class="muted"></p></section>`;
  action($("#login"), async (d) => {
    let x = await api("/auth/login", "POST", d);
    S.token = x.token;
    S.user = x.user;
    sessionStorage.setItem("hsts_token", x.token);
    show("dashboard");
  });
}
function forbidden() {
  page(
    "Forbidden",
    "You do not have permission to access this page.",
    "<button onclick=\"show('dashboard')\">Return to dashboard</button>",
  );
}
function notFound() {
  page(
    "Not found",
    "The requested page or record does not exist.",
    "<button onclick=\"show('dashboard')\">Return to dashboard</button>",
  );
}
async function show(view, arg) {
  if (!S.user) return renderLogin();
  S.view = view;
  nav();
  $("#main").innerHTML = "<p>Loading…</p>";
  try {
    switch (view) {
      case "dashboard":
        return dashboard();
      case "profile":
        return profile();
      case "records":
        return records();
      case "add":
        return recordForm();
      case "detail":
        return detail(arg);
      case "edit":
        return recordForm(arg);
      case "queue":
        return queue();
      case "reports":
        return reports();
      case "notifications":
        return notifications();
      case "users":
        return users();
      case "audit":
        return audit();
      case "countries":
      case "institutions":
      case "programmes":
        return master(view);
      default:
        return notFound();
    }
  } catch (e) {
    page(
      "Error",
      e.message,
      "<button onclick=\"show('dashboard')\">Return to dashboard</button>",
    );
  }
}
async function dashboard() {
  let rows = await api("/records");
  let role = S.user.role;
  let cards =
    role === "Student/Alumni"
      ? [
          [rows.length, "My records"],
          [
            rows.filter((x) => x.verification_status === "Submitted").length,
            "Awaiting verification",
          ],
          [
            rows.filter((x) => x.verification_status === "Correction Required")
              .length,
            "Corrections required",
          ],
        ]
      : [
          [rows.length, "Total records"],
          [
            rows.filter((x) => x.verification_status === "Submitted").length,
            "Verification queue",
          ],
          [
            rows.filter((x) => x.progression_status === "Ongoing").length,
            "Ongoing",
          ],
        ];
  page(
    `${role} Dashboard`,
    "Current higher-studies information and work items.",
    `<div class="grid">${cards.map(([v, l]) => `<div class="stat"><strong>${v}</strong><span>${l}</span></div>`).join("")}</div><div class="card"><h2>Recent records</h2>${recordTable(rows.slice(0, 8))}</div>`,
  );
}
async function profile() {
  let u = await api("/profile");
  page(
    "Profile / Account",
    "Update permitted contact details.",
    `<section class="card"><form id="profileForm"><div class="form-grid"><div><label>Name *</label><input name="name" value="${esc(u.name)}" required></div><div><label>Email</label><input value="${esc(u.email)}" disabled></div><div><label>Contact information</label><input name="contact_info" value="${esc(u.contact_info)}"></div><div><label>Role</label><input value="${esc(u.role)}" disabled></div></div><div class="actions"><button>Save profile</button></div></form></section>`,
  );
  action($("#profileForm"), async (d) => {
    S.user = await api("/profile", "PATCH", d);
    nav();
  });
}
function badge(s) {
  return `<span class="badge ${esc(s).split(" ")[0]}">${esc(s)}</span>`;
}
function recordTable(rows) {
  return `<div class="scroll"><table><thead><tr><th>ID</th><th>Student</th><th>Institution</th><th>Programme</th><th>Admission</th><th>Progression</th><th>Verification</th><th></th></tr></thead><tbody>${rows.map((r) => `<tr><td>#${r.id}</td><td>${esc(r.student_name)}</td><td>${esc(r.institution_name)}</td><td>${esc(r.programme_name)}</td><td>${esc(r.admission_status)}</td><td>${badge(r.progression_status)}</td><td>${badge(r.verification_status)}</td><td><button class="secondary" onclick="show('detail',${r.id})">Open</button></td></tr>`).join("") || '<tr><td colspan="8">No records found.</td></tr>'}</tbody></table></div>`;
}
async function loadMaster() {
  let [countries, institutions, programmes] = await Promise.all(
    ["countries", "institutions", "programmes"].map((x) => api("/master/" + x)),
  );
  S.master = { countries, institutions, programmes };
}
function opts(rows, current) {
  return (
    `<option value="">Select…</option>` +
    rows
      .filter((x) => x.active || x.id == current)
      .map(
        (x) =>
          `<option value="${x.id}" ${x.id == current ? "selected" : ""}>${esc(x.name)}${x.degree_type ? " (" + esc(x.degree_type) + ")" : ""}</option>`,
      )
      .join("")
  );
}
async function records() {
  await loadMaster();
  let f = S.filters;
  let params = new URLSearchParams(Object.entries(f).filter(([, v]) => v));
  let rows = await api("/records?" + params);
  let staff = S.user.role !== "Student/Alumni";
  page(
    staff ? "Search Higher-Study Records" : "Higher-Study Profile",
    staff
      ? "Search students and combine record filters."
      : "Your records and verification status.",
    `${
      staff
        ? `<section class="card"><form id="filter"><div class="form-grid"><div><label>Student</label><input name="student" value="${esc(f.student || "")}"></div>${["institution", "programme", "country"].map((k) => `<div><label>${k}</label><select name="${k}_id">${opts(S.master[k === "country" ? "countries" : k + "s"], f[k + "_id"])}</select></div>`).join("")}${[
            "admission_status",
            "progression_status",
            "verification_status",
          ]
            .map(
              (k, i) =>
                `<div><label>${k.replace("_", " ")}</label><select name="${k}"><option value="">All</option>${[
                  [
                    "Applied",
                    "Offer Received",
                    "Admitted",
                    "Rejected",
                    "Deferred",
                  ],
                  ["Not Started", "Ongoing", "Completed", "Discontinued"],
                  ["Draft", "Submitted", "Verified", "Correction Required"],
                ][i]
                  .map(
                    (v) =>
                      `<option ${f[k] === v ? "selected" : ""}>${v}</option>`,
                  )
                  .join("")}</select></div>`,
            )
            .join(
              "",
            )}</div><div class="actions"><button>Apply filters</button><button type="button" class="secondary" id="clear">Clear</button></div></form></section>`
        : `<div class="actions"><button onclick="show('add')">Add Higher-Study Record</button></div>`
    }<section class="card">${recordTable(rows)}</section>`,
  );
  if (staff) {
    action($("#filter"), async (d) => {
      S.filters = d;
      await records();
    });
    $("#clear").onclick = () => {
      S.filters = {};
      records();
    };
  }
}
async function recordForm(id) {
  if (S.user.role !== "Student/Alumni") return forbidden();
  await loadMaster();
  let r = id ? await api("/records/" + id) : {};
  if (id && r.verification_status === "Submitted") return forbidden();
  page(
    id ? "Edit Higher-Study Record" : "Add Higher-Study Record",
    "Select valid master data. Saved records begin or return to Draft.",
    `<section class="card"><form id="recordForm"><div class="form-grid"><div><label>Institution *</label><select name="institution_id" id="institution" required>${opts(S.master.institutions, r.institution_id)}</select></div><div><label>Programme *</label><select name="programme_id" id="programme" required>${opts(S.master.programmes, r.programme_id)}</select></div><div><label>Country *</label><select name="country_id" required>${opts(S.master.countries, r.country_id)}</select></div><div><label>Admission status *</label><select name="admission_status" required>${["Applied", "Offer Received", "Admitted", "Rejected", "Deferred"].map((x) => `<option ${r.admission_status === x ? "selected" : ""}>${x}</option>`).join("")}</select></div><div><label>Start date</label><input name="start_date" type="date" value="${esc(r.start_date || "")}"></div><div><label>Expected completion date</label><input name="expected_completion_date" type="date" value="${esc(r.expected_completion_date || "")}"></div></div><label>Admission evidence reference</label><input name="admission_evidence" value="${esc(r.admission_evidence || "")}" placeholder="Reference or URL"><div class="actions"><button>${id ? "Save changes" : "Save Draft"}</button><button type="button" class="secondary" onclick="show('${id ? "detail" : "records"}'${id ? "," + id : ""})">Cancel</button></div></form></section>`,
  );
  const refresh = () => {
    let p = $("#programme"),
      selected = p.value;
    p.innerHTML = opts(
      S.master.programmes.filter(
        (x) => x.institution_id == $("#institution").value,
      ),
      selected,
    );
  };
  $("#institution").onchange = refresh;
  refresh();
  action($("#recordForm"), async (d) => {
    let x = await api(
      id ? "/records/" + id : "/records",
      id ? "PATCH" : "POST",
      d,
    );
    show("detail", x.id);
  });
}
function history(title, items, fields) {
  return `<section class="card"><h2>${title}</h2>${items.length ? `<div class="scroll"><table><thead><tr>${fields.map(([label]) => `<th>${label}</th>`).join("")}</tr></thead><tbody>${items.map((x) => `<tr>${fields.map(([, k]) => `<td>${esc(x[k])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>` : '<p class="muted">No entries yet.</p>'}</section>`;
}
async function detail(id) {
  let r = await api("/records/" + id);
  S.record = r;
  let student = S.user.role === "Student/Alumni",
    coordinator = S.user.role === "Higher Studies Coordinator";
  await loadMaster();
  let get = (kind, id) =>
    S.master[kind].find((x) => x.id === id)?.name || "Unknown";
  let controls = student
    ? `${["Draft", "Correction Required", "Verified"].includes(r.verification_status) ? `<button class="secondary" onclick="show('edit',${id})">Edit record${r.verification_status === "Verified" ? " (new cycle)" : ""}</button>` : ""}${["Draft", "Correction Required"].includes(r.verification_status) ? `<button onclick="submitRecord(${id})">Submit for Verification</button>` : ""}`
    : coordinator
      ? `${r.verification_status === "Submitted" ? `<button onclick="decide(${id},'Verified')">Verify Record</button><button class="secondary" onclick="decide(${id},'Correction Required')">Request Correction</button>` : ""}<button class="secondary" onclick="updateProgression(${id})">Update Progression</button><button class="secondary" onclick="updateAdmission(${id})">Update Admission</button>`
      : "";
  page(
    "Higher-Study Record #" + id,
    `${r.student.name} · ${r.student.email}`,
    `<div class="grid"><div class="stat"><strong>${esc(r.admission_status)}</strong><span>Admission status</span></div><div class="stat"><strong>${esc(r.progression_status)}</strong><span>Progression</span></div><div class="stat"><strong>${esc(r.verification_status)}</strong><span>Verification</span></div></div><section class="card"><h2>Record details</h2><div class="grid"><p><b>Institution</b><br>${esc(get("institutions", r.institution_id))}</p><p><b>Programme</b><br>${esc(get("programmes", r.programme_id))}</p><p><b>Country</b><br>${esc(get("countries", r.country_id))}</p><p><b>Start date</b><br>${esc(r.start_date || "—")}</p><p><b>Expected completion</b><br>${esc(r.expected_completion_date || "—")}</p><p><b>Admission evidence</b><br>${esc(r.admission_evidence || "—")}</p></div>${r.correction_reason ? `<p class="error"><b>Correction reason:</b> ${esc(r.correction_reason)}</p>` : ""}<div class="actions">${controls}<button class="secondary" onclick="show('records')">Back</button></div></section>${history(
      "Admission history",
      r.admission_history,
      [
        ["Status", "status"],
        ["Date", "update_date"],
        ["Remarks", "remarks"],
      ],
    )}${history("Progression history", r.progression_history, [
      ["Status", "status"],
      ["Date", "update_date"],
      ["Remarks", "remarks"],
    ])}${history("Verification history", r.verification_history, [
      ["Decision", "decision"],
      ["Date", "decision_date"],
      ["Reason", "reason"],
    ])}`,
  );
}
async function submitRecord(id) {
  if (!confirm("Submit this draft for coordinator verification?")) return;
  try {
    await api("/records/" + id + "/submit", "POST");
    notice("Record submitted.");
    show("detail", id);
  } catch (e) {
    notice(e.message, true);
  }
}
function modal(title, fields, onSave) {
  let old = $("#modal");
  if (old) old.remove();
  let d = document.createElement("dialog");
  d.id = "modal";
  d.innerHTML = `<h2>${esc(title)}</h2><form id="modalForm"><div class="form-grid">${fields}</div><div class="actions"><button>Save</button><button type="button" class="secondary" id="cancelModal">Cancel</button></div></form>`;
  document.body.append(d);
  d.showModal();
  $("#cancelModal").onclick = () => d.close();
  d.addEventListener("close", () => d.remove());
  action($("#modalForm"), async (data) => {
    await onSave(data);
    d.close();
  });
}
async function decide(id, decision) {
  if (decision === "Verified") {
    if (!confirm("Verify this submitted record?")) return;
    try {
      await api("/records/" + id + "/verification", "POST", { decision });
      notice("Decision saved and student notified.");
      show("detail", id);
    } catch (e) {
      notice(e.message, true);
    }
    return;
  }
  modal(
    "Request Correction",
    `<div><label for="reason">Correction reason *</label><textarea id="reason" name="reason" required></textarea></div>`,
    async (data) => {
      await api("/records/" + id + "/verification", "POST", {
        decision,
        reason: data.reason,
      });
      show("detail", id);
    },
  );
}
async function updateProgression(id) {
  let r = S.record;
  let choices = {
    "Not Started": ["Ongoing", "Discontinued"],
    Ongoing: ["Completed", "Discontinued"],
    Completed: [],
    Discontinued: [],
  }[r.progression_status];
  if (!choices.length) return notice("This progression is final.", true);
  modal(
    "Update Progression",
    `<div><label for="newStatus">New status *</label><select id="newStatus" name="status" required>${choices.map((x) => `<option>${x}</option>`).join("")}</select></div><div><label for="effectiveDate">Effective date *</label><input id="effectiveDate" name="update_date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></div><div><label for="remarks">Remarks</label><textarea id="remarks" name="remarks"></textarea></div>`,
    async (data) => {
      await api("/records/" + id + "/progression", "POST", data);
      show("detail", id);
    },
  );
}
async function updateAdmission(id) {
  let options = [
    "Applied",
    "Offer Received",
    "Admitted",
    "Rejected",
    "Deferred",
  ].filter((x) => x !== S.record.admission_status);
  modal(
    "Update Admission",
    `<div><label for="admissionStatus">New status *</label><select id="admissionStatus" name="status" required>${options.map((x) => `<option>${x}</option>`).join("")}</select></div><div><label for="admissionDate">Effective date *</label><input id="admissionDate" name="update_date" type="date" value="${new Date().toISOString().slice(0, 10)}" required></div><div><label for="admissionRemarks">Remarks</label><textarea id="admissionRemarks" name="remarks"></textarea></div>`,
    async (data) => {
      await api("/records/" + id + "/admission", "POST", data);
      show("detail", id);
    },
  );
}
async function queue() {
  if (S.user.role !== "Higher Studies Coordinator") return forbidden();
  let rows = await api("/records?verification_status=Submitted");
  page(
    "Verification Queue",
    "Review submitted records and record a decision.",
    `<section class="card">${recordTable(rows)}</section>`,
  );
}
async function reports() {
  if (S.user.role === "Student/Alumni") return forbidden();
  let data = await api("/reports");
  page(
    "Reports and Dashboard",
    "Aggregated higher-study summaries.",
    Object.entries(data)
      .map(
        ([key, rows]) =>
          `<section class="card"><h2>${esc(key.replaceAll("_", " "))}</h2><div class="scroll"><table><thead><tr><th>Category</th><th>Students / records</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(x.label)}</td><td>${x.count}</td></tr>`).join("")}</tbody></table></div></section>`,
      )
      .join(""),
  );
}
async function notifications() {
  let rows = await api("/notifications");
  page(
    "Notifications",
    "Verification outcomes for your records.",
    `<section class="card">${rows.map((x) => `<p>${esc(x.message)} <small class="muted">${esc(x.created_at)}</small></p>`).join("") || "<p>No notifications.</p>"}</section>`,
  );
}
async function users() {
  if (S.user.role !== "Administrator") return forbidden();
  let rows = await api("/users");
  page(
    "User and Role Management",
    "Create, activate, deactivate, and assign approved roles.",
    `<section class="card"><h2>Create user</h2><form id="userForm"><div class="form-grid"><div><label>Name *</label><input name="name" required></div><div><label>Email *</label><input name="email" type="email" required></div><div><label>Role *</label><select name="role">${["Student/Alumni", "Higher Studies Coordinator", "Administrator"].map((x) => `<option>${x}</option>`).join("")}</select></div><div><label>Temporary password *</label><input name="password" type="password" required></div></div><div class="actions"><button>Create user</button></div></form></section><section class="card"><div class="scroll"><table><thead><tr><th>User</th><th>Email</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map((u) => `<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.active ? "Yes" : "No"}</td><td><button class="secondary" onclick="changeRole(${u.id},'${esc(u.role)}')">Role</button> <button class="${u.active ? "danger" : "secondary"}" onclick="toggleUser(${u.id},${u.active ? 0 : 1})">${u.active ? "Deactivate" : "Activate"}</button></td></tr>`).join("")}</tbody></table></div></section>`,
  );
  action($("#userForm"), async (d) => {
    await api("/users", "POST", d);
    users();
  });
}
async function changeRole(id, old) {
  let role = prompt(
    "New role (Student/Alumni, Higher Studies Coordinator, Administrator):",
    old,
  );
  if (!role || role === old) return;
  try {
    await api("/users/" + id, "PATCH", { role });
    notice("Role updated.");
    users();
  } catch (e) {
    notice(e.message, true);
  }
}
async function toggleUser(id, active) {
  if (!confirm(`${active ? "Activate" : "Deactivate"} this account?`)) return;
  try {
    await api("/users/" + id, "PATCH", { active });
    notice("Account updated.");
    users();
  } catch (e) {
    notice(e.message, true);
  }
}
async function master(kind) {
  if (S.user.role !== "Administrator") return forbidden();
  let rows = await api("/master/" + kind);
  await loadMaster();
  let fields =
    kind === "countries"
      ? ["name", "code"]
      : kind === "institutions"
        ? ["name", "city", "country_id"]
        : ["name", "institution_id", "degree_type", "duration"];
  let field = (k) =>
    `<div><label>${esc(k.replace("_", " "))} *</label>${k === "country_id" || k === "institution_id" ? `<select name="${k}" required>${opts(S.master[k === "country_id" ? "countries" : "institutions"])}</select>` : `<input name="${k}" ${k === "duration" ? "" : "required"}>`}</div>`;
  page(
    kind[0].toUpperCase() + kind.slice(1) + " Management",
    "Maintain controlled reference data used by records.",
    `<section class="card"><h2>Add ${kind.slice(0, -1)}</h2><form id="masterForm"><div class="form-grid">${fields.map(field).join("")}</div><div class="actions"><button>Create</button></div></form></section><section class="card"><div class="scroll"><table><thead><tr>${fields.map((k) => `<th>${esc(k)}</th>`).join("")}<th>Active</th><th>Actions</th></tr></thead><tbody>${rows.map((x) => `<tr>${fields.map((k) => `<td>${esc(x[k])}</td>`).join("")}<td>${x.active ? "Yes" : "No"}</td><td><button class="secondary" onclick="editMaster('${kind}',${x.id})">Edit</button> <button class="${x.active ? "danger" : "secondary"}" onclick="toggleMaster('${kind}',${x.id},${x.active ? 0 : 1})">${x.active ? "Deactivate" : "Activate"}</button></td></tr>`).join("")}</tbody></table></div></section>`,
  );
  action($("#masterForm"), async (d) => {
    await api("/master/" + kind, "POST", d);
    master(kind);
  });
}
async function editMaster(kind, id) {
  let x = S.master[kind].find((y) => y.id === id),
    data = {};
  let fields =
    kind === "countries"
      ? ["name", "code"]
      : kind === "institutions"
        ? ["name", "city", "country_id"]
        : ["name", "institution_id", "degree_type", "duration"];
  for (let key of fields) {
    let value = prompt("Update " + key + ":", x[key]);
    if (value === null) return;
    data[key] = value;
  }
  try {
    await api("/master/" + kind + "/" + id, "PATCH", data);
    notice("Master data updated.");
    master(kind);
  } catch (e) {
    notice(e.message, true);
  }
}
async function toggleMaster(kind, id, active) {
  if (!confirm(`${active ? "Activate" : "Deactivate"} this item?`)) return;
  try {
    await api("/master/" + kind + "/" + id, "PATCH", { active });
    notice("Master data updated.");
    master(kind);
  } catch (e) {
    notice(e.message, true);
  }
}
async function audit() {
  if (S.user.role !== "Administrator") return forbidden();
  let rows = await api("/audit");
  page(
    "Audit Records",
    "Recent state-changing operations.",
    `<section class="card"><div class="scroll"><table><thead><tr><th>Timestamp</th><th>Actor ID</th><th>Action</th><th>Entity</th><th>ID</th><th>Detail</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(x.timestamp)}</td><td>${x.actor_id}</td><td>${esc(x.action)}</td><td>${esc(x.entity)}</td><td>${x.entity_id}</td><td>${esc(x.detail)}</td></tr>`).join("")}</tbody></table></div></section>`,
  );
}
(async () => {
  if (!S.token) return renderLogin();
  try {
    S.user = await api("/profile");
    show("dashboard");
  } catch {
    renderLogin();
  }
})();
