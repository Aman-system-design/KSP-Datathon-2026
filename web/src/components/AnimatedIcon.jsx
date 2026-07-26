export function AnimatedIcon({ icon: Icon, children, motion = 'lift', ...props }) {
  return <span className="animate-icon" data-animate-icon={motion} {...props}>
    {children ?? <Icon aria-hidden="true" />}
  </span>;
}
