import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import { getReports } from './api.js';
import { AppContext } from './context.js';
import Header from './components/Header.jsx';
import Home from './pages/Home.jsx';
import ReportPage from './pages/ReportPage.jsx';

function NotFound() {
  return (
    <main id="main" className="page narrow">
      <h1>Page not found</h1>
      <p className="lede">
        There is nothing at this address. <Link to="/">Go to the report list</Link>.
      </p>
    </main>
  );
}

export default function App() {
  const [state, setState] = useState({ status: 'loading', reports: [], filterDefs: {}, error: null });

  const load = useCallback(() => {
    setState((s) => ({ ...s, status: 'loading', error: null }));
    getReports()
      .then((res) => setState({ status: 'ready', reports: res.reports, filterDefs: res.filters, error: null }))
      .catch((error) => setState({ status: 'error', reports: [], filterDefs: {}, error }));
  }, []);

  useEffect(load, [load]);

  const value = useMemo(() => ({ ...state, reload: load }), [state, load]);

  return (
    <AppContext.Provider value={value}>
      <a className="skip-link" href="#main">Skip to content</a>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reports/:id" element={<ReportPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AppContext.Provider>
  );
}
