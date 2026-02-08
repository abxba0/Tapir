# Tapir Website

The official documentation and marketing website for [Tapir](../README.md) - built with Next.js 15, React 19, and Material-UI.

## Overview

The Tapir website serves as the project's documentation hub and marketing site. It provides:
- Interactive feature showcase
- Getting started guides
- Usage examples and tutorials
- Component documentation
- Project information

## Technology Stack

- **[Next.js](https://nextjs.org)** 15.3.0 - React framework with App Router
- **[React](https://react.dev)** 19.0.0 - UI library
- **[Material-UI (MUI)](https://mui.com)** 6.4.0 - Component library
- **[Emotion](https://emotion.sh)** - CSS-in-JS styling
- **[Tabler Icons](https://tabler-icons.io/)** - Icon set
- **[TypeScript](https://typescriptlang.org)** 5.7.0 - Type safety

## Prerequisites

| Dependency | Version | Purpose |
|------------|---------|---------|
| **[Node.js](https://nodejs.org)** | >= 18.0 | JavaScript runtime |
| **[npm](https://npmjs.com)** | >= 9.0 | Package manager |

## Installation

```bash
cd website
npm install
```

## Usage

### Development Server

Start the development server with hot-reload:

```bash
npm run dev
```

The site will be available at [http://localhost:3000](http://localhost:3000)

### Production Build

Build the optimized production bundle:

```bash
npm run build
```

This creates an optimized build in the `.next/` directory.

### Production Server

Start the production server:

```bash
npm run build
npm start
```

The server runs on port 3000 by default.

### Linting

Check code quality with ESLint:

```bash
npm run lint
```

## Project Structure

```
website/
├── package.json            # Project configuration and dependencies
├── tsconfig.json           # TypeScript configuration
├── next.config.js          # Next.js configuration
├── .eslintrc.json          # ESLint configuration
├── README.md               # This file
└── src/
    ├── app/                # Next.js App Router
    │   ├── layout.tsx      # Root layout
    │   ├── page.tsx        # Landing page
    │   ├── global.css      # Global styles
    │   └── (DashboardLayout)/  # Dashboard routes
    │       ├── layout.tsx          # Dashboard layout
    │       ├── components/         # Dashboard components
    │       ├── page.tsx            # Dashboard home
    │       ├── features/           # Features showcase
    │       ├── getting-started/    # Getting started guide
    │       ├── download/           # Download documentation
    │       ├── transcribe/         # Transcription docs
    │       └── text-to-speech/     # TTS documentation
    ├── services/           # API service layer (future)
    └── utils/              # Shared utilities
```

## Key Features

### App Router (Next.js 15)

The website uses Next.js 15's App Router with Server Components by default:
- File-based routing
- Layouts and nested routes
- Server and Client Components
- Streaming and Suspense

### Material-UI Integration

Material-UI v6 is configured with Emotion for styling:
- Custom theme configuration
- Server-side rendering support
- Responsive design system
- Icon integration

### Route Groups

The `(DashboardLayout)` route group provides a consistent layout for documentation pages without affecting the URL structure.

## Pages

### Landing Page (`/`)
- Hero section
- Feature highlights
- Quick start guide
- Installation instructions

### Dashboard (`/`)
- Overview of Tapir capabilities
- Quick navigation to feature docs
- Recent updates

### Features (`/features`)
- Detailed feature showcase
- Use case examples
- Technical capabilities

### Getting Started (`/getting-started`)
- Installation guide
- Prerequisites
- First-time setup
- Basic usage examples

### Download (`/download`)
- Download feature documentation
- Supported sites
- Format selection
- Advanced options

### Transcribe (`/transcribe`)
- Transcription feature guide
- Whisper model selection
- Output formats
- Best practices

### Text-to-Speech (`/text-to-speech`)
- TTS feature documentation
- Supported engines
- Voice selection
- Document formats

## Development Guidelines

### Adding New Pages

1. Create a new directory in `src/app/(DashboardLayout)/`
2. Add a `page.tsx` file
3. Export a React component
4. Update navigation in the layout

Example:

```typescript
// src/app/(DashboardLayout)/my-feature/page.tsx
export default function MyFeaturePage() {
  return (
    <div>
      <h1>My Feature</h1>
      <p>Feature documentation...</p>
    </div>
  );
}
```

### Styling Components

Use Material-UI's `sx` prop or Emotion's `styled` API:

```typescript
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

// Using sx prop
<Box sx={{ padding: 2, backgroundColor: 'primary.main' }}>
  Content
</Box>

// Using styled API
const StyledBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.primary.main,
}));
```

### Server vs Client Components

- **Server Components** (default): Use for static content, data fetching, SEO
- **Client Components**: Use for interactivity, browser APIs, state management

Mark Client Components with `'use client'` directive:

```typescript
'use client';

import { useState } from 'react';

export default function InteractiveComponent() {
  const [count, setCount] = useState(0);
  // ...
}
```

## Configuration

### Next.js Config

The `next.config.js` file configures:
- Build settings
- Image optimization
- Experimental features

### TypeScript Config

The `tsconfig.json` includes:
- Path aliases
- Strict mode
- Next.js optimizations

### ESLint Config

ESLint is configured with:
- Next.js recommended rules
- TypeScript support
- React best practices

## Deployment

### Vercel (Recommended)

Deploy to Vercel with zero configuration:

```bash
npm install -g vercel
vercel
```

### Docker

Build a Docker image:

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "start"]
```

### Static Export

For static hosting:

```bash
# Modify next.config.js to add: output: 'export'
npm run build
# Deploy the 'out' directory
```

## Environment Variables

Create a `.env.local` file for local development:

```bash
# Example environment variables
NEXT_PUBLIC_API_URL=http://localhost:8384
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

## Contributing

When contributing to the website:
1. Follow the existing code structure
2. Maintain consistent styling
3. Add proper TypeScript types
4. Test on multiple screen sizes
5. Update documentation as needed

## Performance

The website is optimized for performance:
- Server-side rendering (SSR)
- Automatic code splitting
- Image optimization
- Font optimization
- Static generation where possible

## Accessibility

The website follows accessibility best practices:
- Semantic HTML
- ARIA labels
- Keyboard navigation
- Color contrast
- Screen reader support

## Browser Support

The website supports:
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

[MIT](../LICENSE)
