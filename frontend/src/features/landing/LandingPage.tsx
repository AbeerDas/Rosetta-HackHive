import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  Stack,
  useTheme,
  alpha,
  Fade,
} from '@mui/material';
import {
  Translate as TranslateIcon,
  MenuBook as MenuBookIcon,
  Speed as SpeedIcon,
  RecordVoiceOver as VoiceIcon,
  AutoStories as NotesIcon,
  QuestionAnswer as QuestionIcon,
  Public as PublicIcon,
  School as SchoolIcon,
} from '@mui/icons-material';
import { AuthModal } from '../auth/AuthModal';

// Greetings in various languages for scrolling banner
const greetings = [
  'Hello', 'नमस्ते', 'ওহে', '你好', 'Hola', 'Bonjour', '안녕하세요', 'Γεια σας',
  'שלום', 'مرحبا', 'გამარჯობა', 'Привет', 'Прывітанне', 'Здраво', 'Сәлем',
  'Сайн байна уу', 'Здравей', 'こんにちは', 'ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ', 'ಹಲೋ', 'ഹലോ', 'வணக்கம்',
];

// Animated Counter Component
function AnimatedCounter({ end, duration = 2000, suffix = '', isPercentage = false }: { 
  end: number; 
  duration?: number; 
  suffix?: string; 
  isPercentage?: boolean;
}) {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const countRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const currentRef = countRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.3 }
    );

    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  useEffect(() => {
    if (isInView && !hasAnimated) {
      setHasAnimated(true);
      let startTime: number;
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        
        // Suspenseful easing function - slow start, fast middle, very slow end (plateauing)
        // Uses a custom easing curve that creates dramatic buildup
        const suspensefulEase = (t: number) => {
          if (t < 0.5) {
            // First half: slow acceleration (ease-in-quad)
            return 2 * t * t;
          } else {
            // Second half: dramatic deceleration (ease-out-quart)
            const shifted = t - 1;
            return 1 - Math.pow(shifted, 4);
          }
        };
        
        const easedProgress = suspensefulEase(progress);
        const current = Math.floor(easedProgress * end);
        
        setCount(current);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setCount(end);
        }
      };
      
      requestAnimationFrame(animate);
    }
  }, [isInView, end, duration, hasAnimated]);

  const formatNumber = (num: number) => {
    if (isPercentage) return `${num}%`;
    return num.toLocaleString();
  };

  return (
    <span ref={countRef}>
      {formatNumber(count)}{suffix}
    </span>
  );
}

// Scrolling Greetings Component
function ScrollingGreetingsLanding() {
  const theme = useTheme();
  return (
    <Box
      sx={{
        width: '100vw',
        marginLeft: 'calc(-50vw + 50%)',
        overflow: 'hidden',
        position: 'relative',
        mt: 10,
        mb: 6,
        py: 3,
        '&::before, &::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          width: 200,
          height: '100%',
          zIndex: 1,
          pointerEvents: 'none',
        },
        '&::before': {
          left: 0,
          background: `linear-gradient(to right, ${theme.palette.background.default}, transparent)`,
        },
        '&::after': {
          right: 0,
          background: `linear-gradient(to left, ${theme.palette.background.default}, transparent)`,
        },
      }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          animation: 'scrollGreetings 50s linear infinite',
          '@keyframes scrollGreetings': {
            '0%': { transform: 'translateX(0)' },
            '100%': { transform: 'translateX(-50%)' },
          },
        }}
      >
        {[...greetings, ...greetings].map((greeting, index) => (
          <Typography
            key={index}
            component="span"
            sx={{
              fontFamily: '"ABeeZee", -apple-system, BlinkMacSystemFont, sans-serif',
              color: alpha(theme.palette.text.secondary, 0.5),
              fontWeight: 400,
              fontSize: { xs: '2rem', md: '2.75rem' },
              whiteSpace: 'nowrap',
              px: { xs: 2, md: 4 },
              flexShrink: 0,
            }}
          >
            {greeting}
          </Typography>
        ))}
      </Box>
    </Box>
  );
}

export function LandingPage() {
  const theme = useTheme();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);
  const [isInFeaturesSection, setIsInFeaturesSection] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0); // 0-1 progress to next feature
  const featuresContainerRef = useRef<HTMLDivElement>(null);
  const scrollAccumulator = useRef(0);
  const isScrollLocked = useRef(false);

  const features = [
    {
      icon: <TranslateIcon sx={{ fontSize: 64 }} />,
      title: 'Real-Time Translation',
      description: 'Instantly translate lectures from English to your native language with natural-sounding AI voice synthesis.',
      color: theme.palette.primary.main,
    },
    {
      icon: <VoiceIcon sx={{ fontSize: 64 }} />,
      title: 'Live Transcription',
      description: "See every word as it's spoken with real-time speech-to-text transcription displayed beautifully on screen.",
      color: '#9C27B0',
    },
    {
      icon: <MenuBookIcon sx={{ fontSize: 64 }} />,
      title: 'Smart Citations',
      description: 'Automatically surface relevant course materials and textbook pages as the professor discusses topics.',
      color: '#2196F3',
    },
    {
      icon: <SpeedIcon sx={{ fontSize: 64 }} />,
      title: 'Zero Latency',
      description: 'Experience translations in under 2 seconds with our optimized AI pipeline built for real-time performance.',
      color: '#FF9800',
    },
    {
      icon: <NotesIcon sx={{ fontSize: 64 }} />,
      title: 'Structured Notes',
      description: 'Generate comprehensive, citation-rich lecture notes with one click. Edit, enhance, and export as PDF.',
      color: '#4CAF50',
    },
    {
      icon: <QuestionIcon sx={{ fontSize: 64 }} />,
      title: 'Question Translator',
      description: 'Type questions in your language and get instant English translations to ask your professor confidently.',
      color: '#E91E63',
    },
  ];

  const SCROLL_THRESHOLD = 275;

  // Handle wheel events - natural locking without jumping
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!featuresContainerRef.current) return;

    const container = featuresContainerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Check if container is in view
    const isInView = rect.top < window.innerHeight * 0.5 && rect.bottom > window.innerHeight * 0.5;

    // Natural lock when scrolling into the section
    if (isInView && !isScrollLocked.current && Math.abs(rect.top) < 50) {
      isScrollLocked.current = true;
      setIsInFeaturesSection(true);
    }

    if (isScrollLocked.current) {
      // Allow scrolling at boundaries
      if (activeFeatureIndex === 0 && e.deltaY < 0) {
        // At first feature, scrolling up - release
        isScrollLocked.current = false;
        setIsInFeaturesSection(false);
        scrollAccumulator.current = 0;
        setScrollProgress(0);
        return; // Let scroll happen naturally
      }
      
      if (activeFeatureIndex === features.length - 1 && e.deltaY > 0) {
        // At last feature, scrolling down - release
        isScrollLocked.current = false;
        setIsInFeaturesSection(false);
        scrollAccumulator.current = 0;
        setScrollProgress(0);
        return; // Let scroll happen naturally
      }

      // Lock scrolling and accumulate
      e.preventDefault();
      scrollAccumulator.current += e.deltaY;

      // Calculate progress (0-1)
      const progress = Math.abs(scrollAccumulator.current) / SCROLL_THRESHOLD;
      setScrollProgress(Math.min(progress, 1));

      if (scrollAccumulator.current > SCROLL_THRESHOLD) {
        scrollAccumulator.current = 0;
        setScrollProgress(0);
        setActiveFeatureIndex(prev => Math.min(prev + 1, features.length - 1));
      } else if (scrollAccumulator.current < -SCROLL_THRESHOLD) {
        scrollAccumulator.current = 0;
        setScrollProgress(0);
        setActiveFeatureIndex(prev => Math.max(prev - 1, 0));
      }
    }
  }, [features.length, activeFeatureIndex]);

  // Set up wheel event listener
  useEffect(() => {
    const wheelHandler = (e: WheelEvent) => handleWheel(e);
    window.addEventListener('wheel', wheelHandler, { passive: false });
    return () => window.removeEventListener('wheel', wheelHandler);
  }, [handleWheel]);

  // Lock body scroll when in features section
  useEffect(() => {
    if (isInFeaturesSection) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isInFeaturesSection]);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Animated background gradient */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '100vh',
          background: `
            radial-gradient(ellipse at 20% 20%, ${alpha(theme.palette.primary.main, 0.05)} 0%, transparent 50%),
            radial-gradient(ellipse at 80% 80%, ${alpha(theme.palette.secondary.main, 0.03)} 0%, transparent 50%)
          `,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Fixed Header */}
      <Box
        component="header"
        sx={{
          py: 2,
          px: 3,
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backdropFilter: 'blur(10px)',
          bgcolor: alpha(theme.palette.background.default, 0.8),
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        }}
      >
        <Container maxWidth="lg">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                component="img"
                src="/icons/logo/Logo.svg"
                alt="Rosetta"
                sx={{ height: 32, width: 'auto' }}
              />
              <Typography variant="h5" fontWeight={700} color="primary.main">
                Rosetta
              </Typography>
            </Box>
            <Button
              variant="outlined"
              onClick={() => setAuthModalOpen(true)}
              sx={{
                textTransform: 'none',
                borderRadius: 2,
                px: 3,
              }}
            >
              Sign In
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* Hero Section */}
      <Box sx={{ position: 'relative', zIndex: 1, pt: 12 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', pt: { xs: 8, md: 12 }, pb: { xs: 4, md: 6 } }}>
            <Fade in timeout={600}>
              <Typography
                variant="h1"
                sx={{
                  fontSize: { xs: '2.5rem', md: '3.5rem', lg: '4.5rem' },
                  fontWeight: 700,
                  lineHeight: 1.1,
                  mb: 3,
                  background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${theme.palette.primary.main} 100%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Break language barriers.
                <br />
                Learn without limits.
              </Typography>
            </Fade>

            <Fade in timeout={800} style={{ transitionDelay: '200ms' }}>
              <Typography
                variant="h5"
                color="text.secondary"
                sx={{
                  maxWidth: 640,
                  mx: 'auto',
                  mb: 5,
                  lineHeight: 1.6,
                  fontWeight: 400,
                }}
              >
                Real-time lecture translation powered by AI. Understand every word,
                connect with course materials, and focus on learning—not translating.
              </Typography>
            </Fade>

            <Fade in timeout={800} style={{ transitionDelay: '400ms' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" alignItems="center">
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setAuthModalOpen(true)}
                  sx={{
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 5,
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.25)}`,
                    '&:hover': {
                      boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.35)}`,
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease',
                  }}
                >
                  Get Started Free
                </Button>
                <Typography variant="body2" color="text.secondary">
                  No credit card required
                </Typography>
              </Stack>
            </Fade>

            {/* Language badges */}
            <Fade in timeout={800} style={{ transitionDelay: '600ms' }}>
              <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" sx={{ mt: 6, gap: 1 }}>
                {['English', 'Hindi', 'Chinese', 'French', 'Spanish', 'Bengali'].map((lang) => (
                  <Box
                    key={lang}
                    sx={{
                      px: 2.5,
                      py: 1,
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      borderRadius: 5,
                      fontSize: '0.9rem',
                      color: 'primary.main',
                      fontWeight: 500,
                    }}
                  >
                    {lang}
                  </Box>
                ))}
              </Stack>
            </Fade>
          </Box>

          {/* Scrolling Greetings Banner */}
          <ScrollingGreetingsLanding />
        </Container>
      </Box>

      {/* SCROLLYTELLING FEATURES SECTION */}
      <Box
        ref={featuresContainerRef}
        sx={{
          position: 'relative',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          mb: 12,
        }}
      >
        {/* Centered content */}
        <Box
          sx={{
            textAlign: 'center',
            maxWidth: 800,
            px: 4,
            width: '100%',
          }}
        >
          {features.map((feature, index) => (
            <Box
              key={feature.title}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100%',
                maxWidth: 700,
                px: 4,
                opacity: activeFeatureIndex === index ? 1 : 0,
                transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: activeFeatureIndex === index ? 'auto' : 'none',
              }}
            >
              <Box
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: 4,
                  bgcolor: alpha(feature.color, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 4,
                  color: feature.color,
                  transform: activeFeatureIndex === index ? 'scale(1) rotate(0deg)' : 'scale(0.7) rotate(-10deg)',
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {feature.icon}
              </Box>

              <Typography
                variant="h2"
                fontWeight={700}
                sx={{
                  mb: 3,
                  fontSize: { xs: '2rem', md: '3rem' },
                  transform: activeFeatureIndex === index ? 'translateY(0)' : 'translateY(30px)',
                  opacity: activeFeatureIndex === index ? 1 : 0,
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.1s',
                }}
              >
                {feature.title}
              </Typography>

              <Typography
                variant="h5"
                color="text.secondary"
                sx={{
                  lineHeight: 1.7,
                  fontWeight: 400,
                  maxWidth: 600,
                  mx: 'auto',
                  transform: activeFeatureIndex === index ? 'translateY(0)' : 'translateY(30px)',
                  opacity: activeFeatureIndex === index ? 1 : 0,
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.2s',
                }}
              >
                {feature.description}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Progress indicator with lines */}
        <Box
          sx={{
            position: 'absolute',
            right: { xs: 20, md: 60 },
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {features.map((_, index) => (
            <Box key={index} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Dot */}
              <Box
                onClick={() => setActiveFeatureIndex(index)}
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: activeFeatureIndex === index ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.25),
                  transition: 'all 0.3s ease',
                  transform: activeFeatureIndex === index ? 'scale(1.5)' : 'scale(1)',
                  cursor: 'pointer',
                  zIndex: 2,
                  boxShadow: activeFeatureIndex === index ? `0 0 12px ${alpha(theme.palette.primary.main, 0.6)}` : 'none',
                  '&:hover': {
                    transform: 'scale(1.3)',
                    bgcolor: theme.palette.primary.main,
                    boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.6)}`,
                  },
                }}
              />
              
              {/* Progress line to next dot */}
              {index < features.length - 1 && (
                <Box sx={{ position: 'relative', height: 40, width: 3, my: 0.5 }}>
                  {/* Background line */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      bgcolor: alpha(theme.palette.primary.main, 0.15),
                      borderRadius: 2,
                    }}
                  />
                  {/* Progress fill */}
                  {activeFeatureIndex === index && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${scrollProgress * 100}%`,
                        bgcolor: theme.palette.primary.main,
                        borderRadius: 2,
                        transition: 'height 0.1s ease-out',
                        boxShadow: `0 0 8px ${alpha(theme.palette.primary.main, 0.4)}`,
                      }}
                    />
                  )}
                  {/* Filled when past this feature */}
                  {activeFeatureIndex > index && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        bgcolor: theme.palette.primary.main,
                        borderRadius: 2,
                      }}
                    />
                  )}
                </Box>
              )}
            </Box>
          ))}
        </Box>

        {/* Scroll indicator */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 40,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            opacity: 0.6,
            animation: 'bounce 2s infinite',
            '@keyframes bounce': {
              '0%, 20%, 50%, 80%, 100%': { transform: 'translateX(-50%) translateY(0)' },
              '40%': { transform: 'translateX(-50%) translateY(-10px)' },
              '60%': { transform: 'translateX(-50%) translateY(-5px)' },
            },
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {isInFeaturesSection ? 'Keep scrolling' : 'Scroll to explore'}
          </Typography>
          <Box
            sx={{
              width: 24,
              height: 40,
              border: '2px solid',
              borderColor: 'text.secondary',
              borderRadius: 12,
              display: 'flex',
              justifyContent: 'center',
              pt: 1,
            }}
          >
            <Box
              sx={{
                width: 4,
                height: 8,
                bgcolor: 'text.secondary',
                borderRadius: 2,
                animation: 'scrollDot 2s infinite',
                '@keyframes scrollDot': {
                  '0%': { transform: 'translateY(0)', opacity: 1 },
                  '100%': { transform: 'translateY(16px)', opacity: 0 },
                },
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* REST OF THE PAGE */}
      <Box sx={{ position: 'relative', zIndex: 1, bgcolor: 'background.default' }}>
        {/* Enhanced Problem Statement Section */}
        <Box sx={{ py: { xs: 8, md: 12 }, position: 'relative' }}>
          <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
            {/* Heading */}
            <Typography
              variant="h2"
              fontWeight={700}
              textAlign="center"
              sx={{
                mb: 2,
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                background: `linear-gradient(135deg, ${theme.palette.text.primary} 0%, ${theme.palette.primary.main} 100%)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Built for students like you
            </Typography>

            {/* Tagline */}
            <Typography
              variant="body1"
              color="text.secondary"
              textAlign="center"
              sx={{ mb: 10, fontSize: '1.1rem' }}
            >
              Empowering learning across languages, cultures, and classrooms worldwide.
            </Typography>

            {/* Stats Grid - Creative 3D Cards with Animated Counters */}
            <Grid container spacing={4} sx={{ mb: 10 }}>
              {[
                { icon: <PublicIcon sx={{ fontSize: 48 }} />, statValue: 6000000, suffix: '+', label: 'International students studying abroad annually', color: theme.palette.primary.main, gradient: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)` },
                { icon: <SchoolIcon sx={{ fontSize: 48 }} />, statValue: 70, isPercentage: true, label: 'Report difficulty understanding lectures in a second language', color: theme.palette.primary.main, gradient: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.9)} 0%, ${theme.palette.primary.main} 100%)` },
              ].map((item, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card
                    elevation={0}
                    sx={{
                      height: '100%',
                      background: theme.palette.mode === 'dark' ? alpha(item.color, 0.08) : '#fff',
                      border: '1px solid',
                      borderColor: alpha(item.color, 0.2),
                      borderRadius: 4,
                      textAlign: 'center',
                      py: 5,
                      px: 3,
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-12px) scale(1.02)',
                        boxShadow: `0 24px 48px ${alpha(item.color, 0.25)}`,
                        borderColor: item.color,
                        '& .stat-icon': {
                          transform: 'scale(1.1) rotate(5deg)',
                        },
                        '&::before': {
                          opacity: 1,
                        },
                      },
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 6,
                        background: item.gradient,
                        opacity: 0.7,
                        transition: 'opacity 0.4s ease',
                      },
                    }}
                  >
                    <Box
                      className="stat-icon"
                      sx={{
                        width: 100,
                        height: 100,
                        borderRadius: '50%',
                        background: item.gradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mx: 'auto',
                        mb: 3,
                        color: '#fff',
                        boxShadow: `0 8px 24px ${alpha(item.color, 0.3)}`,
                        transition: 'transform 0.4s ease',
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Typography
                      variant="h2"
                      fontWeight={800}
                      sx={{
                        background: item.gradient,
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        mb: 2,
                        fontSize: { xs: '3rem', md: '3.5rem' },
                        letterSpacing: '-0.02em',
                      }}
                    >
                      <AnimatedCounter 
                        end={item.statValue} 
                        suffix={item.suffix || ''} 
                        isPercentage={item.isPercentage || false}
                        duration={2500}
                      />
                    </Typography>
                    <Typography
                      variant="body1"
                      color="text.primary"
                      sx={{
                        fontWeight: 500,
                        lineHeight: 1.6,
                        fontSize: '0.95rem',
                      }}
                    >
                      {item.label}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>

            {/* Main message - simplified */}
            <Box sx={{ textAlign: 'center', maxWidth: 800, mx: 'auto', px: { xs: 2, md: 4 } }}>
              <Typography
                variant="h5"
                sx={{
                  lineHeight: 1.8,
                  fontWeight: 400,
                  color: 'text.primary',
                  fontSize: { xs: '1.125rem', md: '1.35rem' },
                }}
              >
                Rosetta eliminates the cognitive burden of mental translation, letting you focus on what matters: learning.
              </Typography>
            </Box>
          </Container>
        </Box>

        {/* CTA Section */}
        <Container maxWidth="lg">
          <Box sx={{ py: { xs: 8, md: 12 }, textAlign: 'center', mb: 8 }}>
            <Box
              sx={{
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, ${alpha(theme.palette.secondary.main, 0.08)} 100%)`,
                borderRadius: 4,
                py: { xs: 6, md: 8 },
                px: { xs: 3, md: 6 },
                border: '1px solid',
                borderColor: alpha(theme.palette.primary.main, 0.2),
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                },
              }}
            >
              <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
                Ready to transform your lecture experience?
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 500, mx: 'auto' }}>
                Join thousands of students who are already learning without language
                barriers. Get started in seconds.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => setAuthModalOpen(true)}
                sx={{
                  textTransform: 'none',
                  borderRadius: 2,
                  px: 6,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 12px 24px ${alpha(theme.palette.primary.main, 0.4)}`,
                  },
                }}
              >
                Start Learning Now
              </Button>
            </Box>
          </Box>
        </Container>

        {/* Footer */}
        <Box
          component="footer"
          sx={{
            py: 4,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <Container maxWidth="lg">
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={2}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box
                  component="img"
                  src="/icons/logo/Logo.svg"
                  alt="Rosetta"
                  sx={{ height: 24, width: 'auto', opacity: 0.7 }}
                />
                <Typography variant="body2" color="text.secondary">
                  © 2026 Rosetta. Built for HackHive 2026.
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Breaking language barriers in education.
              </Typography>
            </Stack>
          </Container>
        </Box>
      </Box>

      {/* Auth Modal */}
      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </Box>
  );
}
