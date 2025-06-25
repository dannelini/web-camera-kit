# Web Camera Kit 📸

A **lightweight, mobile-optimized camera boilerplate** designed specifically for AI vision and computer vision projects. Built with React, TypeScript, and modern web APIs to provide a solid foundation for real-world applications.

## 🚀 Live Demo

**[Try the Live Demo](https://web-camera-kit-demo.netlify.app)**

## ✨ Key Features

### 📱 **Mobile-First Design**
- **Responsive interface** optimized for both mobile and desktop
- **Touch-friendly controls** with intuitive gestures
- **PWA capabilities** with offline support and installable app experience
- **Dynamic viewport handling** for seamless mobile experience

### 📷 **Advanced Camera Functionality**
- **Photo and video capture** with high-quality output
- **Real-time camera switching** (front/back on mobile, device selection on desktop)
- **Live video processing** with canvas-based frame manipulation
- **Customizable video constraints** for optimal quality per device type
- **Robust error handling** and retry mechanisms

### 💾 **Smart Storage System**
- **IndexedDB integration** for persistent media storage
- **Automatic data recovery** when app reopens
- **Efficient blob management** with proper cleanup
- **Gallery with thumbnail generation** for videos

### 🎨 **Modern UI/UX**
- **Beautiful animations** powered by GSAP
- **Glassmorphism design elements** with backdrop blur effects
- **Adaptive layouts** that work across all screen sizes
- **Accessibility-first approach** with proper focus management

### ⚡ **Performance Optimized**
- **Lazy loading** and efficient resource management
- **Service worker** for offline functionality
- **Optimized video processing** with frame-rate management
- **Memory leak prevention** with proper cleanup patterns

## 🎯 Perfect For

- **AI Vision Projects** - Ready-to-use camera input for machine learning models
- **Computer Vision Applications** - Real-time video processing capabilities
- **Educational Tools** - Clean codebase for learning modern web development
- **Prototyping** - Quick setup for camera-based proof of concepts
- **Production Apps** - Production-ready code with robust error handling

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS with custom animations
- **Icons**: Lucide React
- **Animations**: GSAP
- **Storage**: IndexedDB for media persistence
- **PWA**: Service Worker + Web App Manifest
- **Build Tool**: Vite with PWA plugin
- **Media APIs**: WebRTC, MediaRecorder, Canvas API

## 📦 Installation

### Prerequisites
- Node.js 16+ and npm/yarn
- Modern browser with camera support
- HTTPS for production (required for camera access)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/web-camera-kit.git
cd web-camera-kit

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🚀 Deployment

### Netlify (Recommended)
The project is pre-configured for Netlify deployment:

```bash
npm run build
# Deploy the 'dist' folder to Netlify
```

### Other Platforms
Works with any static hosting service:
- Vercel
- GitHub Pages  
- AWS S3 + CloudFront
- Firebase Hosting

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Disable loading screen (optional)
VITE_APP_DISABLE_LOADING_SCREEN=false

# Disable PWA features (optional)
VITE_APP_DISABLE_PWA=false
```

### Customization Options

#### Camera Settings
```typescript
// Modify in src/components/CameraPreview.tsx
const videoConstraints = {
  width: { ideal: 1920, max: 2560 },
  height: { ideal: 1080, max: 1440 },
  frameRate: { ideal: 30, max: 60 }
};
```

#### Storage Configuration
```typescript
// Modify in src/utils/indexedDb.ts
const dbConfig = {
  dbName: 'YourAppMedia',
  dbVersion: 1,
  storeName: 'media'
};
```

#### PWA Settings
```typescript
// Modify in vite.config.ts
VitePWA({
  manifest: {
    name: 'Your App Name',
    short_name: 'YourApp',
    theme_color: '#your-color'
  }
})
```

## 📱 Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Photo Capture | ✅ | ✅ | ✅ | ✅ |
| Video Recording | ✅ | ✅ | ✅ | ✅ |
| Camera Switching | ✅ | ✅ | ✅ | ✅ |
| PWA Install | ✅ | ✅ | ✅ | ✅ |
| IndexedDB | ✅ | ✅ | ✅ | ✅ |

### Minimum Versions
- Chrome 63+
- Firefox 65+
- Safari 12+
- Edge 79+

## 🏗️ Architecture

### Project Structure
```
src/
├── components/          # React components
│   ├── CameraPreview.tsx    # Main camera interface
│   ├── MediaGallery.tsx     # Gallery with thumbnails
│   ├── MediaPreviewModal.tsx # Full-screen media viewer
│   ├── LoadingScreen.tsx    # Permission request screen
│   └── InstallPrompt.tsx    # PWA install prompt
├── hooks/               # Custom React hooks
│   ├── useMediaCapture.ts   # Media capture logic
│   └── useMobileDetection.ts # Device detection
├── utils/               # Utility functions
│   ├── indexedDb.ts         # Database operations
│   └── pwa.ts              # PWA management
├── types/               # TypeScript definitions
│   └── media.ts            # Media-related types
└── styles/              # Styling
    └── index.css           # Global styles + Tailwind
```

### Key Components

#### CameraPreview
- Handles camera initialization and switching
- Manages photo/video capture
- Processes real-time video streams
- Provides responsive controls

#### MediaGallery  
- Displays captured media with thumbnails
- Handles media deletion and downloads
- Provides batch operations

#### MediaPreviewModal
- Full-screen media viewing
- Download and sharing functionality
- Mobile-optimized controls

### Custom Hooks

#### useMediaCapture
- Manages captured media state
- Handles IndexedDB persistence
- Provides download functionality

#### useMobileDetection
- Detects device type and orientation
- Manages responsive behavior
- Handles PWA detection

## 🔐 Security & Privacy

- **No external data transmission** - All media stays on device
- **Secure camera access** - Proper permission handling
- **Local storage only** - IndexedDB for client-side persistence
- **HTTPS required** - Enforced for camera API access

## 🔧 Development

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production  
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Adding New Features

1. **New Camera Modes**: Extend `CameraMode` type and add handlers
2. **Custom Filters**: Modify canvas processing in `CameraPreview`
3. **Export Formats**: Add new formats in `useMediaCapture` hook
4. **UI Themes**: Customize Tailwind config and component styles

### Integration Examples

#### AI Model Integration
```typescript
// Example: Adding AI processing
const processWithAI = async (imageBlob: Blob) => {
  const formData = new FormData();
  formData.append('image', imageBlob);
  
  const response = await fetch('/api/ai-process', {
    method: 'POST',
    body: formData
  });
  
  return response.json();
};
```

#### Computer Vision
```typescript
// Example: OpenCV.js integration
const processWithOpenCV = (canvas: HTMLCanvasElement) => {
  const src = cv.imread(canvas);
  // Your CV processing here
  cv.imshow('output', src);
  src.delete();
};
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - UI library
- [Tailwind CSS](https://tailwindcss.com/) - Styling framework
- [GSAP](https://greensock.com/gsap/) - Animation library
- [Lucide](https://lucide.dev/) - Icon library
- [Vite](https://vitejs.dev/) - Build tool

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/web-camera-kit/issues)
- **Documentation**: This README and code comments
- **Community**: [Discussions](https://github.com/yourusername/web-camera-kit/discussions)

---

*Ready to build amazing camera-powered applications? Star ⭐ this repo and start creating!*