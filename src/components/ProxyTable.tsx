import React from 'react';
import { ProxyEntry } from '../types';
import { Settings } from 'lucide-react';

interface ProxyTableProps {
  proxies: ProxyEntry[];
  toggleProxy: (index: number) => void;
  openSettings: (index: number) => void;
}

const ProxyTable: React.FC<ProxyTableProps> = ({ proxies, toggleProxy, openSettings }) => {
  return (
    <table>
      <thead>
        <tr>
          <th>Active</th>
          <th>Host</th>
          <th>Port</th>
          <th>Login</th>
          <th>Password</th>
          <th>Settings</th>
        </tr>
      </thead>
      <tbody>
        {proxies.map((proxy, index) => (
          <tr key={index}>
            <td>
              <input
                type="checkbox"
                checked={proxy.active}
                onChange={() => toggleProxy(index)}
              />
            </td>
            <td>{proxy.host}</td>
            <td>{proxy.port}</td>
            <td>{proxy.login}</td>
            <td>{proxy.password}</td>
            <td>
              <button onClick={() => openSettings(index)}>
                <Settings size={20} />
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default ProxyTable;