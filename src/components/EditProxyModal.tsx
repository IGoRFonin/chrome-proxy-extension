import React, { useState, useEffect } from "react";
import { ProxyEntry } from "../types";

interface EditProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  proxy: ProxyEntry;
  onSave: (updatedProxy: ProxyEntry) => void;
}

const EditProxyModal: React.FC<EditProxyModalProps> = ({
  isOpen,
  onClose,
  proxy,
  onSave,
}) => {
  const [formData, setFormData] = useState<ProxyEntry>({
    active: false,
    name: "",
    host: "",
    port: "",
    login: "",
    password: "",
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (proxy) {
      setFormData({
        ...proxy,
        name: proxy.name || "",
      });
    }
  }, [proxy]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.host.trim()) {
      newErrors.host = "Host is required";
    }

    if (!formData.port.trim()) {
      newErrors.port = "Port is required";
    } else if (!/^\d+$/.test(formData.port)) {
      newErrors.port = "Port must be a number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof ProxyEntry, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Edit Proxy</h3>
          <button className="close-button" onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Name (optional)</label>
            <input
              id="name"
              type="text"
              placeholder="e.g., US-1, Germany-Proxy, etc."
              value={formData.name || ""}
              onChange={(e) => handleInputChange("name", e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="host">
              Host <span className="required">*</span>
            </label>
            <input
              id="host"
              type="text"
              placeholder="192.168.1.1"
              value={formData.host}
              onChange={(e) => handleInputChange("host", e.target.value)}
              className={`form-input ${errors.host ? "error" : ""}`}
              required
            />
            {errors.host && (
              <span className="error-message">{errors.host}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="port">
              Port <span className="required">*</span>
            </label>
            <input
              id="port"
              type="text"
              placeholder="8080"
              value={formData.port}
              onChange={(e) => handleInputChange("port", e.target.value)}
              className={`form-input ${errors.port ? "error" : ""}`}
              required
            />
            {errors.port && (
              <span className="error-message">{errors.port}</span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="login">Login</label>
            <input
              id="login"
              type="text"
              placeholder="username"
              value={formData.login}
              onChange={(e) => handleInputChange("login", e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="password"
              value={formData.password}
              onChange={(e) => handleInputChange("password", e.target.value)}
              className="form-input"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-button">
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProxyModal;
