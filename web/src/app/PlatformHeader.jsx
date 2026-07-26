import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { OrganizationBrand } from '../components/OrganizationBrand.jsx';
import { AccountMenu } from './AccountMenu.jsx';
import { governedAppLocation } from './runtime.js';
import { usePlatformBrand } from '../branding/BrandProvider.jsx';

export function PlatformHeader({ workspace, auth, onPersonaChange }) {
  const location = useLocation();
  const brand = usePlatformBrand();
  const commandCenterStyle = workspace?.role === 'STATION_OPERATIONS';
  const account = <AccountMenu workspace={workspace} auth={auth} onPersonaChange={onPersonaChange} />;
  return <header className={`topbar${commandCenterStyle ? ' topbar--command-center' : ''}`} role="banner">
    <div className="platform-identity">
      <OrganizationBrand compact />
      <span><strong>{brand.organizationName}</strong>{brand.showProductTagline && <small>{brand.productTagline}</small>}</span>
    </div>
    <div className="global-search">
      <Icon name="intelligence" size={17} />
      <input type="search" aria-label={commandCenterStyle ? 'Search' : 'Global search'} placeholder={commandCenterStyle ? '' : 'Search is available after governed indexing'} disabled />
    </div>
    {commandCenterStyle ? account : null}
    <NavLink className="header-alert" to={governedAppLocation('/alerts', location)} aria-label="Alerts"><Icon name="alerts" /></NavLink>
    <button className="header-utility" type="button" aria-label="Settings"><Icon name="settings" /></button>
    {commandCenterStyle ? null : account}
  </header>;
}
