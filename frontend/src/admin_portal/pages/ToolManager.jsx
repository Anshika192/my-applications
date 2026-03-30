import React, { useState } from "react";
import axios from "axios";

export default function ToolManager({ tools, API_BASE, loadTools }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("active");

  const addTool = async () => {
    if (!name.trim()) return alert("Enter tool name");

    try {
      const token = localStorage.getItem("admin_token");

      await axios.post(
        `${API_BASE}/api/admin/tools`,
        { name, category, status },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setName("");
      setCategory("");
      loadTools();
      alert("Tool added ✔");
    } catch (e) {
      alert("Failed to add tool");
    }
  };

  const disableTool = async (id) => {
    if (!window.confirm("Disable this tool?")) return;

    try {
      const token = localStorage.getItem("admin_token");

      await axios.delete(`${API_BASE}/api/admin/tools/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      loadTools();
      alert("Tool disabled ✔");
    } catch (e) {
      alert("Failed to disable tool");
    }
  };

  const enableTool = async (id) => {
    try {
      const token = localStorage.getItem("admin_token");

      await axios.post(
        `${API_BASE}/api/admin/tools/${id}/enable`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      loadTools();
      alert("Tool enabled ✔");
    } catch (e) {
      alert("Failed to enable tool");
    }
  };

  return (
    <div className="table-container wide">
      <h3>Manage Tools</h3>

      <div className="logs-filter-bar">
        <div className="field">
          <label>Tool Name</label>
          <input
            value={name}
            placeholder="Enter tool name"
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Category</label>
          <input
            value={category}
            placeholder="Category (optional)"
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <button className="btn-apply" onClick={addTool}>
          Add Tool
        </button>
      </div>

      <table className="feedback-table" style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <th style={{ width: "35%" }}>Name</th>
            <th style={{ width: "25%" }}>Category</th>
            <th style={{ width: "15%" }}>Status</th>
            <th style={{ width: "25%" }}>Actions</th>
          </tr>
        </thead>

        <tbody>
          {tools.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.category || "-"}</td>
              <td>
                <span
                  className={
                    t.status === "active" ? "badge badge-green" : "badge badge-grey"
                  }
                >
                  {t.status}
                </span>
              </td>

              <td>
                {t.status === "disabled" ? (
                  <button
                    className="btn-apply"
                    style={{ background: "#10b981" }}
                    onClick={() => enableTool(t.id)}
                  >
                    Enable
                  </button>
                ) : (
                  <button
                    className="btn-apply"
                    style={{ background: "#ef4444" }}
                    onClick={() => disableTool(t.id)}
                  >
                    Disable
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}