import React, { useState, useEffect } from "react";
import { ProxySettings } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProxySettings;
  onSave: (settings: ProxySettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
}) => {
  const [mode, setMode] = useState(settings.mode);

  useEffect(() => {
    setMode(settings.mode);
  }, [settings]);

  const handleSave = () => {
    onSave({
      mode,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      <h2>Proxy Settings</h2>
      <div className="proxy-settings-container">
        <div className="mode-option">
          <label>
            <input
              type="radio"
              value="global"
              checked={mode === "global"}
              onChange={() => setMode("global")}
            />
            <div className="mode-info">
              <strong>Global mode</strong>
              <p>
                Use one active proxy for all domains. Simple and
                straightforward.
              </p>
            </div>
          </label>
        </div>

        <div className="mode-option">
          <label>
            <input
              type="radio"
              value="domain-based"
              checked={mode === "domain-based"}
              onChange={() => setMode("domain-based")}
            />
            <div className="mode-info">
              <strong>Domain-based mode</strong>
              <p>
                Use multiple active proxies, each with their own domain lists.
                Advanced routing with conflict resolution by priority.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="mode-explanation">
        {mode === "global" && (
          <div className="explanation-box">
            <h4>How Global Mode Works:</h4>
            <ul>
              <li>Only one proxy can be active at a time</li>
              <li>All internet traffic goes through the active proxy</li>
              <li>Perfect for simple proxy switching</li>
            </ul>
          </div>
        )}

        {mode === "domain-based" && (
          <div className="explanation-box">
            <h4>How Domain-Based Mode Works:</h4>
            <ul>
              <li>Multiple proxies can be active simultaneously</li>
              <li>Each proxy has its own list of domains</li>
              <li>Traffic is routed based on domain matching</li>
              <li>Conflicts are resolved by proxy priority (order in list)</li>
              <li>Domains not matched by any proxy go direct</li>
            </ul>
            <p>
              <strong>Note:</strong> Configure domains for each proxy in the
              Edit dialog.
            </p>
          </div>
        )}
      </div>

      <div className="modal-actions">
        <button onClick={handleSave} className="save-button">
          Save
        </button>
        <button onClick={onClose} className="cancel-button">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SettingsModal;
