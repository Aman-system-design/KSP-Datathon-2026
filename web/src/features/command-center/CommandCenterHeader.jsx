import { Bell, Settings } from 'lucide-react';
import { usePlatformBrand } from '../../branding/BrandProvider.jsx';
import { CommandCenterAppearanceMenu } from './CommandCenterAppearanceMenu.jsx';
import { CommandCenterPersonaMenu } from './CommandCenterPersonaMenu.jsx';

export function CommandCenterHeader({ appearance, personas, accountOpen, settingsOpen, onAppearanceChange, onAccountToggle, onSettingsToggle, onPersonaSelect, onAllWorkspaces }) {
  const brand = usePlatformBrand();
  return <header className="command-center-header">
    <div className="command-center-header__brand"><img src={brand.primaryLogo} alt={`${brand.organizationName} emblem`} /><div><strong>{brand.organizationName}</strong><span>Analytics · Crime · Enforcement</span></div></div>
    <div className="command-center-header__utilities" data-testid="command-center-header-utilities">
      <button type="button" aria-label="Notifications" disabled><Bell aria-hidden="true" /></button>
      <div className="command-center-settings">
        <button type="button" aria-label="Open settings" aria-expanded={settingsOpen} onClick={onSettingsToggle}><Settings aria-hidden="true" /></button>
        {settingsOpen ? <CommandCenterAppearanceMenu value={appearance} onChange={onAppearanceChange} /> : null}
      </div>
      <div className="command-center-account">
        <button className="command-center-avatar" type="button" aria-label="Open account menu" aria-expanded={accountOpen} onClick={onAccountToggle}>S</button>
        {accountOpen ? <CommandCenterPersonaMenu personas={personas} onSelect={onPersonaSelect} onAllWorkspaces={onAllWorkspaces} /> : null}
      </div>
    </div>
  </header>;
}
