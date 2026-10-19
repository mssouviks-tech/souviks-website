(() => {
  "use strict";

  const root = document.getElementById("lead-dashboard");
  if (!root) return;

  const $ = selector => root.querySelector(selector);
  const statusNode = $("#dashboard-status");
  const leadsBody = $("#leads-body");
  const funnelBody = $("#funnel-body");
  const outcomePanel = $("#outcome-panel");
  const manualForm = $("#manual-lead-form");
  let selectedLead = null;
  let lastLoadedLeads = [];

  const STATUSES = [
    ["received", "Received"],
    ["quoted", "Quotation sent"],
    ["accepted", "Quotation accepted"],
    ["won", "Order won"],
    ["lost", "Lost"],
    ["unqualified", "Unqualified"]
  ];

  function status(message, kind = "") {
    statusNode.textContent = message || "";
    statusNode.className = "notice" + (kind ? " " + kind : "");
  }

  function el(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (className) node.className = className;
    return node;
  }

  function button(text, className, onClick) {
    const node = el("button", text, className || "button");
    node.type = "button";
    node.addEventListener("click", onClick);
    return node;
  }

  function formatINR(value) {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(amount)
      : "—";
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? "—"
      : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function pretty(value) {
    const source = String(value || "unknown").replace(/_/g, " ");
    return source.charAt(0).toUpperCase() + source.slice(1);
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  async function rpc(name, args) {
    if (typeof supabaseClient === "undefined" || !supabaseClient?.rpc) {
      throw new Error("The Supabase client is unavailable.");
    }
    const { data, error } = await supabaseClient.rpc(name, args);
    if (error) throw error;
    return data;
  }

  function selectedFilters() {
    return {
      p_from: $("#filter-from").value || null,
      p_to: $("#filter-to").value || null,
      p_status: $("#filter-status").value || null,
      p_channel: $("#filter-channel").value || null,
      p_query: $("#filter-query").value.trim() || null
    };
  }

  function total(rows, key) {
    return (rows || []).reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
  }

  function renderMetrics(rows) {
    const values = [
      ["Enquiries received", total(rows, "enquiries_received")],
      ["Quotations sent", total(rows, "quotations_sent")],
      ["Orders won", total(rows, "orders_won")],
      ["Won order value", formatINR(total(rows, "won_order_value_inr"))]
    ];
    const container = $("#metric-grid");
    clear(container);
    for (const [label, value] of values) {
      const card = el("div", undefined, "metric");
      card.append(el("span", label, "metric-label"), el("strong", value, "metric-value"));
      container.appendChild(card);
    }
  }

  function renderFunnel(rows) {
    clear(funnelBody);
    if (!rows?.length) {
      const tr = el("tr");
      const td = el("td", "No enquiries in the selected date range.", "empty-cell");
      td.colSpan = 9;
      tr.appendChild(td);
      funnelBody.appendChild(tr);
      return;
    }
    for (const row of rows) {
      const tr = document.createElement("tr");
      const values = [
        pretty(row.first_touch_channel),
        [row.first_touch_source, row.first_touch_medium].filter(Boolean).join(" / ") || "—",
        row.first_touch_campaign || "—",
        pretty(row.last_touch_channel),
        Number(row.enquiries_received) || 0,
        Number(row.quotations_sent) || 0,
        Number(row.orders_won) || 0,
        (Number(row.enquiry_to_order_rate_percent || 0)).toFixed(2) + "%",
        formatINR(row.won_order_value_inr)
      ];
      for (const value of values) tr.appendChild(el("td", value));
      funnelBody.appendChild(tr);
    }
  }

  function renderLeads(rows) {
    lastLoadedLeads = Array.isArray(rows) ? rows : [];
    clear(leadsBody);
    if (!lastLoadedLeads.length) {
      const tr = el("tr");
      const td = el("td", "No leads match these filters.", "empty-cell");
      td.colSpan = 7;
      tr.appendChild(td);
      leadsBody.appendChild(tr);
      return;
    }

    for (const lead of lastLoadedLeads) {
      const tr = document.createElement("tr");
      tr.appendChild(el("td", lead.lead_reference || "—", "reference-cell"));
      tr.appendChild(el("td", lead.customer_name || "—"));
      tr.appendChild(el("td", lead.customer_phone || lead.customer_email || "—"));
      tr.appendChild(el("td", pretty(lead.first_touch_channel || lead.source_channel)));
      tr.appendChild(el("td", pretty(lead.status), "status-cell status-" + String(lead.status || "received")));
      tr.appendChild(el("td", formatDate(lead.created_at)));
      const actionCell = el("td");
      actionCell.appendChild(button(selectedLead?.lead_id === lead.lead_id ? "Selected" : "Manage", "button small", () => selectLead(lead)));
      tr.appendChild(actionCell);
      leadsBody.appendChild(tr);
    }

    if (selectedLead) {
      const current = lastLoadedLeads.find(lead => lead.lead_id === selectedLead.lead_id);
      if (current) selectLead(current, false);
      else closeOutcome();
    }
  }

  function selectLead(lead, scroll = true) {
    selectedLead = lead;
    outcomePanel.hidden = false;
    $("#selected-reference").textContent = lead.lead_reference + " · " + (lead.customer_name || "Customer name not recorded");
    $("#selected-details").textContent = [
      lead.customer_phone ? "Phone: " + lead.customer_phone : "",
      lead.customer_email ? "Email: " + lead.customer_email : "",
      lead.company ? "Company: " + lead.company : "",
      "Source: " + [pretty(lead.first_touch_channel), lead.first_touch_source, lead.first_touch_medium, lead.first_touch_campaign].filter(Boolean).join(" / "),
      lead.lead_details || ""
    ].filter(Boolean).join("\n");

    $("#outcome-status").value = lead.status || "received";
    $("#quote-reference").value = lead.quote_reference || "";
    $("#order-reference").value = lead.order_reference || "";
    $("#order-value").value = lead.order_value === null || lead.order_value === undefined ? "" : String(lead.order_value);
    $("#internal-note").value = lead.internal_note || "";
    $("#order-reference").required = $("#outcome-status").value === "won";
    $("#order-value").required = $("#outcome-status").value === "won";
    if (scroll) outcomePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function closeOutcome() {
    selectedLead = null;
    outcomePanel.hidden = true;
  }

  async function loadDashboard() {
    status("Loading funnel and lead records…");
    const filters = selectedFilters();
    const [funnel, leads] = await Promise.all([
      rpc("staff_channel_funnel_report", { p_from: filters.p_from, p_to: filters.p_to }),
      rpc("staff_list_sales_leads", {
        p_limit: 100,
        p_offset: 0,
        p_status: filters.p_status,
        p_channel: filters.p_channel,
        p_query: filters.p_query,
        p_from: filters.p_from,
        p_to: filters.p_to
      })
    ]);
    renderMetrics(funnel);
    renderFunnel(funnel);
    renderLeads(leads);
    status("Loaded " + leads.length + " most recent leads. Funnel counts include all leads in the selected date range.", "success");
  }

  function setDefaultDates() {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    const iso = date => date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
    $("#filter-from").value = iso(from);
    $("#filter-to").value = iso(today);
  }

  function displayError(error) {
    const text = String(error?.message || error || "");
    if (/Sales staff access required|42501|permission denied|not authorized/i.test(text)) {
      status(
        "Your session is signed in but has no sales-staff permission. A Supabase administrator must set trusted app_metadata role to admin or sales (or add that value to app_metadata.roles), then refresh your session. Do not set this in user_metadata.",
        "error"
      );
    } else if (/JWT|session|auth/i.test(text)) {
      status("Your session has expired. Sign in again, then reopen this staff dashboard.", "error");
    } else {
      status("The dashboard request failed. Please retry. " + text.slice(0, 240), "error");
    }
  }

  async function handleManualLead(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const type = String(formData.get("lead_type") || "phone");
    const channel = type === "manual" ? "offline" : type;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const result = await rpc("staff_create_manual_lead", {
        p_lead_type: type,
        p_source_channel: channel,
        p_customer_name: String(formData.get("customer_name") || "").trim(),
        p_customer_phone: String(formData.get("customer_phone") || "").trim(),
        p_customer_email: String(formData.get("customer_email") || "").trim() || null,
        p_company: String(formData.get("company") || "").trim() || null,
        p_lead_details: String(formData.get("lead_details") || "").trim() || null,
        p_source: type === "phone" ? "phone_call" : type === "whatsapp" ? "whatsapp_chat" : type === "email" ? "email_enquiry" : "walk_in_or_offline",
        p_medium: "offline",
        p_campaign: String(formData.get("campaign") || "").trim() || null,
        p_internal_note: String(formData.get("internal_note") || "").trim() || null
      });
      form.reset();
      status("Manual enquiry recorded: " + (result?.lead_reference || "reference unavailable"), "success");
      await loadDashboard();
    } catch (error) {
      displayError(error);
    } finally {
      submit.disabled = false;
    }
  }

  async function handleOutcome(event) {
    event.preventDefault();
    if (!selectedLead) {
      status("Select a lead before saving an outcome.", "error");
      return;
    }
    const submit = $("#save-outcome");
    submit.disabled = true;
    const rawValue = $("#order-value").value.trim();
    const amount = rawValue === "" ? null : Number(rawValue);
    if (rawValue !== "" && (!Number.isFinite(amount) || amount < 0)) {
      status("Enter a valid non-negative order value.", "error");
      submit.disabled = false;
      return;
    }

    try {
      await rpc("staff_update_sales_lead", {
        p_lead_id: selectedLead.lead_id,
        p_status: $("#outcome-status").value,
        p_quote_reference: $("#quote-reference").value.trim() || null,
        p_order_reference: $("#order-reference").value.trim() || null,
        p_order_value: amount,
        p_internal_note: $("#internal-note").value
      });
      status("Saved outcome for " + selectedLead.lead_reference + ".", "success");
      await loadDashboard();
    } catch (error) {
      displayError(error);
    } finally {
      submit.disabled = false;
    }
  }

  async function initialize() {
    if (typeof supabaseClient === "undefined" || !supabaseClient?.auth) {
      status("The authentication client is unavailable. Refresh the page and retry.", "error");
      return;
    }

    const { data, error } = await supabaseClient.auth.getSession();
    if (error) {
      displayError(error);
      return;
    }
    if (!data?.session) {
      status("Sign in with your Souviks account, then reopen this staff dashboard.", "error");
      return;
    }

    setDefaultDates();
    $("#apply-filters").addEventListener("click", () => loadDashboard().catch(displayError));
    $("#refresh-dashboard").addEventListener("click", () => loadDashboard().catch(displayError));
    $("#clear-outcome").addEventListener("click", closeOutcome);
    manualForm.addEventListener("submit", handleManualLead);
    $("#outcome-form").addEventListener("submit", handleOutcome);
    $("#outcome-status").addEventListener("change", event => {
      const won = event.target.value === "won";
      $("#order-reference").required = won;
      $("#order-value").required = won;
    });

    try {
      await loadDashboard();
    } catch (error) {
      displayError(error);
    }
  }

  document.addEventListener("DOMContentLoaded", initialize, { once: true });
})();
