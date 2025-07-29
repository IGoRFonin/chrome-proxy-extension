# Chrome Proxy Extension

A Chrome browser extension that allows users to easily configure and manage multiple proxy settings directly from their browser. This extension provides a simple interface to modify proxy settings without diving into Chrome's settings menu.

## Features

### Multi-Proxy Support
- **Global Mode**: Use one active proxy for all domains (simple proxy switching)
- **Domain-Based Mode**: Use multiple active proxies simultaneously, each with their own domain lists
- Advanced routing with automatic conflict resolution by priority

### Proxy Management
- Quick proxy enable/disable toggle
- Easy-to-use interface for adding and managing multiple proxies
- Supports different proxy protocols (HTTP/HTTPS)
- Bulk proxy import from various formats
- In-line proxy name editing

### Domain Control
- Flexible domain configuration for each proxy
- Wildcard domain support (e.g., `*.google.com`)
- Context menu integration for quick domain addition
- Automatic conflict detection and resolution
- Priority-based routing for overlapping domains

### User Experience
- Real-time conflict warnings
- Intuitive modal dialogs for configuration
- Visual indicators for active proxies and domain conflicts
- Responsive design for different screen sizes

## Installation

1. Clone this repository
2. Install dependencies: `npm install`
3. Build the extension: `npm run build`
4. Open Chrome and navigate to `chrome://extensions/`
5. Enable "Developer mode" in the top right corner
6. Click "Load unpacked" and select the built `dist` directory

## Usage

### Proxy Modes

#### Global Mode
- Only one proxy can be active at a time
- All internet traffic goes through the active proxy
- Perfect for simple proxy switching scenarios

#### Domain-Based Mode
- Multiple proxies can be active simultaneously
- Each proxy maintains its own list of domains
- Traffic is routed based on domain matching
- Conflicts are resolved by proxy priority (order in list)
- Domains not matched by any proxy go direct

### Adding Proxies

The extension supports multiple proxy formats:
- `host:port`
- `host:port:username:password`
- `username:password@host:port`

### Domain Configuration

- **Exact domains**: `example.com` matches only example.com
- **Wildcard domains**: `*.example.com` matches all subdomains
- **Context menu**: Right-click on any webpage to quickly add domains

### Priority System

In Domain-Based mode, when multiple proxies have overlapping domains:
1. Proxies are prioritized by their order in the list (top = highest priority)
2. The first matching proxy in priority order handles the request
3. Visual warnings show domain conflicts in the interface

## Development

### Project Structure
- `src/types.ts` - TypeScript interfaces and types
- `src/background.ts` - Background script with proxy logic and PAC script generation
- `src/components/` - React UI components
- `src/utils/storage.ts` - Data persistence and migration logic

### Key Features Implementation
- **PAC Script Generation**: Dynamic PAC scripts for complex domain routing
- **Data Migration**: Automatic migration from legacy single-proxy data
- **Conflict Detection**: Real-time domain conflict analysis
- **Context Menu**: Dynamic menu generation based on active proxies

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with both proxy modes
5. Submit a pull request

## License

This project is licensed under the MIT License.
