import React, { useState } from 'react';
import { ProxyEntry } from '../types';

interface AddProxyFormProps {
  addProxyList: (proxyList: string) => void;
}

const AddProxyForm: React.FC<AddProxyFormProps> = ({ addProxyList }) => {
  const [proxyList, setProxyList] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleAddProxyList = (e: React.FormEvent) => {
    e.preventDefault();
    addProxyList(proxyList);
    setProxyList('');
  };

  return (
    <div>
      <button onClick={() => setIsExpanded(!isExpanded)} style={{ marginBottom: '10px' }}>
        {isExpanded ? 'Hide Add Proxy' : 'Add Proxy'}
      </button>
      
      <div style={{
        maxHeight: isExpanded ? '1000px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.5s ease-in-out'
      }}>
        <form onSubmit={handleAddProxyList}>
          <textarea
            placeholder="Enter proxy list"
            value={proxyList}
            onChange={(e) => setProxyList(e.target.value)}
            required
          />
          <p>Example formats (only http/s):</p>
          <ul>
            <li><strong>ip:port</strong></li>
            <li><strong>ip:port:login:password</strong></li>
            <li><strong>login:password@ip:port</strong></li>
          </ul>
          <button type="submit">Add Proxy List</button>
        </form>
      </div>
    </div>
  );
};

export default AddProxyForm;