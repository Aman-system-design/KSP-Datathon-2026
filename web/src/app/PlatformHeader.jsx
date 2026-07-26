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
    <div className="platform-header__utilities" data-testid="platform-header-utilities">
      <NavLink className="header-alert" to={governedAppLocation('/alerts', location)} aria-label="Notifications"><Icon name="alerts" /></NavLink>
      <button className="header-utility" type="button" aria-label="Open settings"><Icon name="settings" /></button>
      <AccountMenu workspace={workspace} auth={auth} onPersonaChange={onPersonaChange} triggerLabel="Open account menu" />
    </div>
  </header>;
}
