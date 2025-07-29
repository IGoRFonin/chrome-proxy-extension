import React, { useState, useEffect } from "react";
import { ProxyEntry } from "../types";

interface EditProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  proxy: ProxyEntry;
  onSave: (updatedProxy: ProxyEntry) => void;
  allProxies?: ProxyEntry[]; // для проверки конфликтов
  currentIndex?: number; // индекс редактируемого прокси
}

const EditProxyModal: React.FC<EditProxyModalProps> = ({
  isOpen,
  onClose,
  proxy,
  onSave,
  allProxies = [],
  currentIndex = -1,
}) => {
  const [formData, setFormData] = useState<ProxyEntry>({
    active: false,
    name: "",
    host: "",
    port: "",
    login: "",
    password: "",
    domains: [],
    priority: 0,
  });

  const [domainsText, setDomainsText] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [domainConflicts, setDomainConflicts] = useState<string[]>([]);

  useEffect(() => {
    if (proxy) {
      setFormData({
        ...proxy,
        name: proxy.name || "",
        domains: proxy.domains || [],
        priority: proxy.priority || 0,
      });
      setDomainsText((proxy.domains || []).join("\n"));
    }
  }, [proxy]);

  // Проверка конфликтов доменов
  useEffect(() => {
    const currentDomains = domainsText
      .split("\n")
      .map((d) => d.trim())
      .filter((d) => d !== "");

    const conflicts: string[] = [];

    if (allProxies.length > 0) {
      currentDomains.forEach((domain) => {
        allProxies.forEach((otherProxy, index) => {
          if (
            index !== currentIndex &&
            otherProxy.active &&
            otherProxy.domains.includes(domain)
          ) {
            const proxyName =
              otherProxy.name || `${otherProxy.host}:${otherProxy.port}`;
            conflicts.push(`${domain} (conflicts with ${proxyName})`);
          }
        });
      });
    }

    setDomainConflicts(conflicts);
  }, [domainsText, allProxies, currentIndex]);

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

    // Валидация доменов
    const domains = domainsText
      .split("\n")
      .map((d) => d.trim())
      .filter((d) => d !== "");

    const invalidDomains = domains.filter((domain) => {
      // Базовая валидация домена
      if (domain.startsWith("*.")) {
        const baseDomain = domain.slice(2);
        return !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(baseDomain);
      }
      return !/^[a-zA-Z0-9.-]+(\.[a-zA-Z]{2,})?$/.test(domain);
    });

    if (invalidDomains.length > 0) {
      newErrors.domains = `Invalid domains: ${invalidDomains.join(", ")}`;
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

  const handleDomainsChange = (value: string) => {
    setDomainsText(value);
    // Clear domain errors when user starts typing
    if (errors.domains) {
      setErrors((prev) => ({
        ...prev,
        domains: "",
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (validateForm()) {
      const domains = domainsText
        .split("\n")
        .map((d) => d.trim())
        .filter((d) => d !== "");

      onSave({
        ...formData,
        domains,
      });
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

          <div className="form-group">
            <label htmlFor="domains">
              Domains
              <span className="help-text">
                (one per line, supports wildcards like *.example.com)
              </span>
            </label>
            <textarea
              id="domains"
              placeholder="example.com
*.google.com
github.com"
              value={domainsText}
              onChange={(e) => handleDomainsChange(e.target.value)}
              className={`form-textarea ${errors.domains ? "error" : ""}`}
              rows={6}
            />
            {errors.domains && (
              <span className="error-message">{errors.domains}</span>
            )}

            {domainConflicts.length > 0 && (
              <div className="conflicts-warning">
                <strong>⚠️ Domain Conflicts:</strong>
                <ul>
                  {domainConflicts.map((conflict, index) => (
                    <li key={index}>{conflict}</li>
                  ))}
                </ul>
                <p>
                  <em>
                    Higher priority proxy (earlier in list) will be used for
                    conflicting domains.
                  </em>
                </p>
              </div>
            )}

            <div className="domain-help">
              <h5>Domain Examples:</h5>
              <ul>
                <li>
                  <code>example.com</code> - matches exactly example.com
                </li>
                <li>
                  <code>*.example.com</code> - matches all subdomains of
                  example.com
                </li>
                <li>
                  <code>*.google.com</code> - matches www.google.com,
                  mail.google.com, etc.
                </li>
              </ul>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`submit-button ${
                domainConflicts.length > 0 ? "warning" : ""
              }`}
            >
              {domainConflicts.length > 0
                ? "Save (with conflicts)"
                : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProxyModal;
