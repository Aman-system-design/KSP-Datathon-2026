import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { OrganizationBrand } from '../components/OrganizationBrand.jsx';
import { AccountMenu } from './AccountMenu.jsx';
import { governedAppLocation } from './runtime.js';
import { usePlatformBrand } from '../branding/BrandProvider.jsx';

export function PlatformHeader({ workspace, auth, onPersonaChange }) {
  const location = useLocation();
  const brand = usePlatformBrand();
  return <header className="topbar" role="banner">
    <div className="platform-identity">
      <OrganizationBrand compact />
      <span><strong>{brand.organizationName}</strong>{brand.showProductTagline && <small>{brand.productTagline}</small>}</span>
    </div>
    <div className="global-search">
      <Icon name="intelligence" size={17} />
      <input type="search" aria-label="Global search" placeholder="Search is available after governed indexing" disabled />
    </div>
    <NavLink className="header-alert" to={governedAppLocation('/alerts', location)} aria-label="Alerts"><Icon name="alerts" /></NavLink>
    <AccountMenu workspace={workspace} auth={auth} onPersonaChange={onPersonaChange} />
  </header>;
}
