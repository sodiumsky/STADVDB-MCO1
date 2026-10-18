import { createContext, useContext } from 'react';

// { status: 'loading' | 'ready' | 'error', reports, filterDefs, error, reload }
export const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);
