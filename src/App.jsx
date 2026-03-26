import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import ProcessList from './components/ProcessList';
import ProcessDetails from './components/ProcessDetails';
import KnowledgeBase from './components/KnowledgeBase';
import PeoplePage from './components/People';
import Login from './components/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/done" element={<DashboardLayout />}>
          <Route index element={<Navigate to="pr-validation" replace />} />
          <Route path="pr-validation" element={
            <ProcessList key="pr-validation" title="PR Validation" category="PR Validation" />
          } />
          <Route path="knowledge-base" element={<KnowledgeBase />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="process/:id" element={<ProcessDetails />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
