import React from "react";
import { ProxyEntry } from "../types";
import { Settings } from "lucide-react";

interface ProxyTableProps {
  proxies: ProxyEntry[];
  toggleProxy: (index: number) => void;
  openSettings: (index: number) => void;
  deleteProxy?: (index: number) => void;
  addProxy: () => void;
}

const ProxyTable: React.FC<ProxyTableProps> = ({
  proxies,
  toggleProxy,
  openSettings,
  deleteProxy,
  addProxy,
}) => {
  return (
    <div className="proxy-table-container">
      <div className="proxy-table-header">
        <div className="proxy-header">
          <h2>Proxies</h2>
          <p>
            A list of all proxies in your account including their host, port,
            credentials and status.
          </p>
        </div>

        <div className="add-proxy-container">
          <button className="add-proxy-button" onClick={addProxy}>
            Add proxy
          </button>
        </div>
      </div>

      <table className="proxy-table">
        <thead>
          <tr>
            <th>Active</th>
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
              <td colSpan={6} className="empty-state">
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
                <td>{proxy.host}</td>
                <td>{proxy.port}</td>
                <td>{proxy.login}</td>
                <td>{proxy.password}</td>
                <td className="action-buttons">
                  <button
                    onClick={() => openSettings(index)}
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
