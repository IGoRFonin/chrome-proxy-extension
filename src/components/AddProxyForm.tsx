import React, { useState } from "react";
import { ProxyEntry } from "../types";

interface AddProxyFormProps {
  addProxyList: (proxyList: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const AddProxyForm: React.FC<AddProxyFormProps> = ({
  addProxyList,
  isOpen = false,
  onClose,
}) => {
  const [proxyList, setProxyList] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Use the prop value if provided, otherwise use local state
  const showModal = isOpen !== undefined ? isOpen : isModalOpen;

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setIsModalOpen(false);
    }
  };

  const handleAddProxyList = (e: React.FormEvent) => {
    e.preventDefault();
    addProxyList(proxyList);
    setProxyList("");
    handleClose();
  };

  return (
    <>
      {!onClose && (
        <div className="add-proxy-container">
          <button
            className="add-proxy-button"
            onClick={() => setIsModalOpen(true)}
          >
            Add proxy
          </button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Add Proxy</h3>
              <button className="close-button" onClick={handleClose}>
                &times;
              </button>
            </div>

            <form onSubmit={handleAddProxyList}>
              <div className="form-group">
                <label htmlFor="proxyList">Proxy List</label>
                <textarea
                  id="proxyList"
                  placeholder="Enter proxy list"
                  value={proxyList}
                  onChange={(e) => setProxyList(e.target.value)}
                  required
                  rows={6}
                  className="proxy-textarea"
                />
              </div>

              <div className="format-info">
                <p>Supported formats:</p>
                <ul>
                  <li>
                    <code>ip:port</code>
                  </li>
                  <li>
                    <code>ip:port:login:password</code>
                  </li>
                  <li>
                    <code>login:password@ip:port</code>
                  </li>
                </ul>
                <p className="format-note">One proxy per line</p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleClose}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  Add Proxies
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AddProxyForm;
