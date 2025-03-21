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
  const [selectedDomains, setSelectedDomains] = useState(
    settings.selectedDomains.join("\n")
  );

  useEffect(() => {
    setMode(settings.mode);
    setSelectedDomains(settings.selectedDomains.join("\n"));
  }, [settings]);

  const handleSave = () => {
    onSave({
      mode,
      selectedDomains: selectedDomains
        .split("\n")
        .filter((domain) => domain.trim() !== ""),
    });
    onClose();
  };

  const removeDomain = (domainToRemove: string) => {
    setSelectedDomains((prev) =>
      prev
        .split("\n")
        .filter((domain) => domain !== domainToRemove)
        .join("\n")
    );
  };

  if (!isOpen) return null;

  return (
    <div className="modal">
      <h2>Proxy Settings</h2>
      <div className="proxy-settings-container">
        <label>
          <input
            type="radio"
            value="all"
            checked={mode === "all"}
            onChange={() => setMode("all")}
          />
          For all domains
        </label>
        <label>
          <input
            type="radio"
            value="selected"
            checked={mode === "selected"}
            onChange={() => setMode("selected")}
          />
          For selected domains
        </label>
      </div>
      {mode === "selected" && (
        <div>
          <h3>Domain List:</h3>
          <ul
            style={{
              margin: 0,
              padding: 0,
              display: "flex",
              flexWrap: "wrap",
              listStyle: "none",
            }}
          >
            {selectedDomains.split("\n").map((domain, index) => (
              <li key={index} style={{ marginBottom: "8px", width: "50%" }}>
                <div
                  style={{ display: "flex", gap: "8px", alignItems: "center" }}
                >
                  <button onClick={() => removeDomain(domain)}>X</button>
                  {domain}
                </div>
              </li>
            ))}
          </ul>
          <textarea
            value={selectedDomains}
            onChange={(e) => setSelectedDomains(e.target.value)}
            placeholder="Enter domains (one per line). Use * for wildcards, e.g. *.example.com"
            style={{ height: "80px" }}
          />
          <p>
            Tip: Use * for wildcards, e.g. *.googlevideo.com to include all
            subdomains
          </p>
        </div>
      )}
      <button onClick={handleSave} style={{ marginRight: "8px" }}>
        Save
      </button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

export default SettingsModal;
