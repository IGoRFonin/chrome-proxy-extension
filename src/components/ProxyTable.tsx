import React, { useState } from "react";
import { ProxyEntry, ProxySettings } from "../types";
import { Settings } from "lucide-react";
import ConfirmModal from "./ConfirmModal";

interface ProxyTableProps {
  proxies: ProxyEntry[];
  settings: ProxySettings;
  toggleProxy: (index: number) => void;
  openEditProxy: (index: number) => void;
  openSettings: () => void;
  deleteProxy?: (index: number) => void;
  addProxy: () => void;
  updateProxyName: (index: number, name: string) => void;
}

const ProxyTable: React.FC<ProxyTableProps> = ({
  proxies,
  settings,
  toggleProxy,
  openEditProxy,
  openSettings,
  deleteProxy,
  addProxy,
  updateProxyName,
}) => {
  const [editingNameIndex, setEditingNameIndex] = useState<number | null>(null);
  const [editingNameValue, setEditingNameValue] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

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

  const handleDeleteClick = (index: number) => {
    setDeleteIndex(index);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = () => {
    if (deleteIndex !== null && deleteProxy) {
      deleteProxy(deleteIndex);
      setDeleteIndex(null);
    }
  };

  const getDomainConflicts = (index: number): string[] => {
    const currentProxy = proxies[index];
    if (!currentProxy || !currentProxy.active) return [];

    const conflicts: string[] = [];
    const currentDomains = currentProxy.domains;

    proxies.forEach((proxy, proxyIndex) => {
      if (proxyIndex !== index && proxy.active) {
        currentDomains.forEach((domain) => {
          if (proxy.domains.includes(domain)) {
            conflicts.push(
              `${domain} (conflicts with ${
                proxy.name || proxy.host + ":" + proxy.port
              })`
            );
          }
        });
      }
    });

    return conflicts;
  };

  const formatDomains = (domains: string[]) => {
    if (domains.length === 0) return <em className="no-domains">No domains</em>;

    const firstDomain = domains[0];
    const remaining = domains.length - 1;

    return (
      <span>
        {firstDomain}
        {remaining > 0 && (
          <span className="domain-count"> +{remaining} more</span>
        )}
      </span>
    );
  };

  return (
    <div className="proxy-table-container">
      <div className="proxy-table-header">
        <div className="proxy-header">
          <h2>Proxies</h2>
          <p>
            A list of all proxies in your account including their name, host,
            port, credentials and status.
            {settings.mode === "global" && (
              <>
                <br />
                <strong>Global mode:</strong> Only one proxy can be active at a
                time.
              </>
            )}
            {settings.mode === "domain-based" && (
              <>
                <br />
                <strong>Domain-based mode:</strong> Multiple proxies can be
                active, each with their own domains.
              </>
            )}
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
            <th>Domains</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {proxies.length === 0 ? (
            <tr>
              <td colSpan={6} className="empty-state">
                No proxies added yet
              </td>
            </tr>
          ) : (
            proxies.map((proxy, index) => {
              const conflicts = getDomainConflicts(index);
              return (
                <tr
                  key={index}
                  className={conflicts.length > 0 ? "has-conflicts" : ""}
                >
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
                  <td className="domains-cell">
                    <div className="domains-container">
                      {formatDomains(proxy.domains)}
                      {conflicts.length > 0 && (
                        <div
                          className="conflicts-warning"
                          title={conflicts.join(", ")}
                        >
                          ⚠️ {conflicts.length} conflict
                          {conflicts.length > 1 ? "s" : ""}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="action-buttons">
                    <button
                      onClick={() => openEditProxy(index)}
                      className="edit-button"
                    >
                      Edit
                    </button>
                    {deleteProxy && (
                      <button
                        onClick={() => handleDeleteClick(index)}
                        className="delete-button"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <ConfirmModal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Proxy"
        message={
          deleteIndex !== null
            ? `Are you sure you want to delete proxy ${
                proxies[deleteIndex].name ||
                proxies[deleteIndex].host + ":" + proxies[deleteIndex].port
              }?`
            : "Are you sure you want to delete this proxy?"
        }
        confirmText="Delete"
        cancelText="Cancel"
        isDanger={true}
      />
    </div>
  );
};

export default ProxyTable;
