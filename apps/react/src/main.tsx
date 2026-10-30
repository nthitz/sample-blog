import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { Layout, RouteError } from './shell.tsx';
import '../../../shared/styles.css';

const router = createBrowserRouter([
  {
    Component: Layout,
    hydrateFallbackElement: (
      <main>
        <p role="status">Loading the journal…</p>
      </main>
    ),
    ErrorBoundary: RouteError,
    children: [
      { index: true, lazy: () => import('./pages/home.tsx') },
      { path: 'posts/:slug', lazy: () => import('./pages/post.tsx') },
      { path: 'about', lazy: () => import('./pages/about.tsx') },
      { path: 'contact', lazy: () => import('./pages/contact.tsx') },
      { path: '*', lazy: () => import('./pages/not-found.tsx') },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
