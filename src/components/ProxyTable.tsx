import React, { useState } from "react";
import { ProxyEntry } from "../types";
import { Settings } from "lucide-react";

interface ProxyTableProps {
  proxies: ProxyEntry[];
  toggleProxy: (index: number) => void;
  openEditProxy: (index: number) => void;
  openSettings: () => void;
  deleteProxy?: (index: number) => void;
  addProxy: () => void;
  updateProxyName: (index: number, name: string) => void;
}

const ProxyTable: React.FC<ProxyTableProps> = ({
  proxies,
  toggleProxy,
  openEditProxy,
  openSettings,
  deleteProxy,
  addProxy,
  updateProxyName,
}) => {
  const [editingNameIndex, setEditingNameIndex] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");

  const handleNameDoubleClick = (index: number, currentName: string) => {
    setEditingNameIndex(index);
    setEditingNameValue(currentName || "");
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingNameValue(e.target.value);
  };

  const handleNameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Enter") {
      saveName(index);
    } else if (e.key === "Escape") {
      cancelNameEdit();
    }
  };

  const handleNameBlur = (index: number) => {
    saveName(index);
  };

  const saveName = (index: number) => {
    updateProxyName(index, editingNameValue.trim());
    setEditingNameIndex(null);
    setEditingNameValue("");
  };

  const cancelNameEdit = () => {
    setEditingNameIndex(null);
    setEditingNameValue("");
  };

  return (
    <div className="proxy-table-container">
      <div className="proxy-table-header">
        <div className="proxy-header">
          <h2>Proxies</h2>
          <p>
            A list of all proxies in your account including their name, host,
            port, credentials and status.
          </p>
        </div>

        <div className="add-proxy-container">
          <button
            className="settings-button"
            onClick={openSettings}
            title="Application Settings"
          >
            <Settings size={16} />
            Settings
          </button>
          <button className="add-proxy-button" onClick={addProxy}>
            Add proxy
          </button>
        </div>
      </div>

      <table className="proxy-table">
        <thead>
          <tr>
            <th>Active</th>
            <th>Name</th>
            <th>Host</th>
            <th>Port</th>
            <th>Login</th>
            <th>Password</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {proxies.length === 0 ? (
            <tr>
              <td colSpan={7} className="empty-state">
                No proxies added yet
              </td>
            </tr>
          ) : (
            proxies.map((proxy, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="checkbox"
                    checked={proxy.active}
                    onChange={() => toggleProxy(index)}
                    className="proxy-checkbox"
                  />
                </td>
                <td
                  className="name-cell"
                  onDoubleClick={() =>
                    handleNameDoubleClick(index, proxy.name || "")
                  }
                >
                  {editingNameIndex === index ? (
                    <input
                      type="text"
                      value={editingNameValue}
                      onChange={handleNameChange}
                      onKeyDown={(e) => handleNameKeyDown(e, index)}
                      onBlur={() => handleNameBlur(index)}
                      className="name-input"
                      autoFocus
                      placeholder="Enter name..."
                    />
                  ) : (
                    <span className="name-display">
                      {proxy.name || (
                        <em className="no-name">
                          No name (double-click to edit)
                        </em>
                      )}
                    </span>
                  )}
                </td>
                <td>{proxy.host}</td>
                <td>{proxy.port}</td>
                <td>{proxy.login}</td>
                <td>{proxy.password}</td>
                <td className="action-buttons">
                  <button
                    onClick={() => openEditProxy(index)}
                    className="edit-button"
                  >
                    Edit
                  </button>
                  {deleteProxy && (
                    <button
                      onClick={() => deleteProxy(index)}
                      className="delete-button"
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProxyTable;
