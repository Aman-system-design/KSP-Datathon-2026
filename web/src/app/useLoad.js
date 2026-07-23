import { useEffect, useState } from 'react';

export function useLoad(loader, dependencies = []) {
  const [state, setState] = useState({ loading: true });
  useEffect(() => {
    let active = true;
    setState({ loading: true });
    loader().then(data => active && setState({ data })).catch(error => active && setState({ error }));
    return () => { active = false; };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}
