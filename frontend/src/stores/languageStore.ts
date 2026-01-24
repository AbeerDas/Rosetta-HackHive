import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Supported languages
export type LanguageCode = 'en' | 'zh' | 'hi' | 'es' | 'fr';

// Translation keys
export interface Translations {
  // Navigation
  lectureLens: string;
  settings: string;
  help: string;
  
  // Home Page
  welcomeBack: string;
  subjects: string;
  yourBaseLanguage: string;
  addFolder: string;
  noFoldersYet: string;
  createFolder: string;
  sessions: string;
  
  // Session Page
  active: string;
  sessionEnded: string;
  endSession: string;
  documents: string;
  liveTranscription: string;
  citations: string;
  citationsEmptyMessage: string;
  
  // Audio Controls
  translation: string;
  ready: string;
  live: string;
  connecting: string;
  idle: string;
  paused: string;
  listening: string;
  translating: string;
  stopped: string;
  off: string;
  volume: string;
  
  // Document Panel
  dragDropFiles: string;
  browse: string;
  supportedFormats: string;
  noDocumentsYet: string;
  uploadMaterials: string;
  processing: string;
  
  // Question Translation
  questionTranslation: string;
  typeQuestion: string;
  translate: string;
  detected: string;
  history: string;
  clear: string;
  noTranslationsYet: string;
  speak: string;
  copy: string;
  copied: string;
  
  // Dialogs
  createNewFolder: string;
  folderName: string;
  cancel: string;
  create: string;
  startNewSession: string;
  sessionName: string;
  targetLanguage: string;
  startSession: string;
  
  // End Session Dialog
  endSessionConfirm: string;
  endSessionWarning: string;
  generateNotesQuestion: string;
  saveTranscriptOnly: string;
  endAndGenerateNotes: string;
  
  // Notes
  lectureNotes: string;
  viewTranscript: string;
  viewNotes: string;
  
  // Status
  transcribing: string;
  
  // Languages
  english: string;
  chinese: string;
  hindi: string;
  spanish: string;
  french: string;
  bengali: string;
}

// English translations (default)
const en: Translations = {
  lectureLens: 'LectureLens',
  settings: 'Settings',
  help: 'Help',
  
  welcomeBack: 'Welcome Back',
  subjects: 'Subjects',
  yourBaseLanguage: 'Your Base Language:',
  addFolder: 'Add Folder',
  noFoldersYet: 'No folders yet',
  createFolder: 'Create Folder',
  sessions: 'sessions',
  
  active: 'Active',
  sessionEnded: 'Session Ended',
  endSession: 'End Session',
  documents: 'Documents',
  liveTranscription: 'Live Transcription',
  citations: 'Citations',
  citationsEmptyMessage: 'Citations from your course materials will appear here as the lecture progresses.',
  
  translation: 'Translation:',
  ready: 'Ready',
  live: 'Live',
  connecting: 'Connecting...',
  idle: 'Idle',
  paused: 'Paused',
  listening: 'Listening',
  translating: 'Translating',
  stopped: 'Stopped',
  off: 'Off',
  volume: 'Volume',
  
  dragDropFiles: 'Drag & drop files or',
  browse: 'Browse',
  supportedFormats: 'Supported formats: PDF',
  noDocumentsYet: 'No documents uploaded yet',
  uploadMaterials: 'Upload course materials for smart citations',
  processing: 'Processing...',
  
  questionTranslation: 'Question Translation',
  typeQuestion: 'Type your question in your language...',
  translate: 'Translate',
  detected: 'Detected:',
  history: 'History',
  clear: 'Clear',
  noTranslationsYet: 'No translations yet',
  speak: 'Speak',
  copy: 'Copy',
  copied: 'Copied!',
  
  createNewFolder: 'Create New Folder',
  folderName: 'Folder Name',
  cancel: 'Cancel',
  create: 'Create',
  startNewSession: 'Start New Session',
  sessionName: 'Session Name',
  targetLanguage: 'Target Language',
  startSession: 'Start Session',
  
  endSessionConfirm: 'End Session?',
  endSessionWarning: 'Warning: Once you end the session, you will no longer be able to record new transcriptions. This action cannot be undone.',
  generateNotesQuestion: 'Would you like to generate structured notes from the transcription, or save the transcript only?',
  saveTranscriptOnly: 'Save Transcript Only',
  endAndGenerateNotes: 'End & Generate Notes',
  
  lectureNotes: 'Lecture Notes',
  viewTranscript: 'View Transcript',
  viewNotes: 'View Notes',
  
  transcribing: 'Transcribing',
  
  english: 'English',
  chinese: 'Chinese (Mandarin)',
  hindi: 'Hindi',
  spanish: 'Spanish',
  french: 'French',
  bengali: 'Bengali',
};

// Chinese translations
const zh: Translations = {
  lectureLens: 'LectureLens',
  settings: '设置',
  help: '帮助',
  
  welcomeBack: '欢迎回来',
  subjects: '科目',
  yourBaseLanguage: '您的基础语言：',
  addFolder: '添加文件夹',
  noFoldersYet: '暂无文件夹',
  createFolder: '创建文件夹',
  sessions: '课程',
  
  active: '进行中',
  sessionEnded: '课程已结束',
  endSession: '结束课程',
  documents: '文档',
  liveTranscription: '实时转录',
  citations: '引用',
  citationsEmptyMessage: '随着讲座的进行，您课程材料中的引用将显示在此处。',
  
  translation: '翻译：',
  ready: '就绪',
  live: '直播中',
  connecting: '连接中...',
  idle: '空闲',
  paused: '已暂停',
  listening: '正在收听',
  translating: '翻译中',
  stopped: '已停止',
  off: '关闭',
  volume: '音量',
  
  dragDropFiles: '拖放文件或',
  browse: '浏览',
  supportedFormats: '支持格式：PDF',
  noDocumentsYet: '尚未上传文档',
  uploadMaterials: '上传课程材料以获取智能引用',
  processing: '处理中...',
  
  questionTranslation: '问题翻译',
  typeQuestion: '用您的语言输入问题...',
  translate: '翻译',
  detected: '检测到：',
  history: '历史记录',
  clear: '清除',
  noTranslationsYet: '暂无翻译',
  speak: '朗读',
  copy: '复制',
  copied: '已复制！',
  
  createNewFolder: '创建新文件夹',
  folderName: '文件夹名称',
  cancel: '取消',
  create: '创建',
  startNewSession: '开始新课程',
  sessionName: '课程名称',
  targetLanguage: '目标语言',
  startSession: '开始课程',
  
  endSessionConfirm: '结束课程？',
  endSessionWarning: '警告：一旦结束课程，您将无法录制新的转录。此操作无法撤消。',
  generateNotesQuestion: '您想从转录生成结构化笔记，还是仅保存转录？',
  saveTranscriptOnly: '仅保存转录',
  endAndGenerateNotes: '结束并生成笔记',
  
  lectureNotes: '讲座笔记',
  viewTranscript: '查看转录',
  viewNotes: '查看笔记',
  
  transcribing: '转录中',
  
  english: '英语',
  chinese: '中文（普通话）',
  hindi: '印地语',
  spanish: '西班牙语',
  french: '法语',
  bengali: '孟加拉语',
};

// Hindi translations
const hi: Translations = {
  lectureLens: 'LectureLens',
  settings: 'सेटिंग्स',
  help: 'मदद',
  
  welcomeBack: 'वापसी पर स्वागत है',
  subjects: 'विषय',
  yourBaseLanguage: 'आपकी आधार भाषा:',
  addFolder: 'फ़ोल्डर जोड़ें',
  noFoldersYet: 'अभी तक कोई फ़ोल्डर नहीं',
  createFolder: 'फ़ोल्डर बनाएं',
  sessions: 'सत्र',
  
  active: 'सक्रिय',
  sessionEnded: 'सत्र समाप्त',
  endSession: 'सत्र समाप्त करें',
  documents: 'दस्तावेज़',
  liveTranscription: 'लाइव ट्रांसक्रिप्शन',
  citations: 'उद्धरण',
  citationsEmptyMessage: 'व्याख्यान के दौरान आपकी पाठ्य सामग्री से उद्धरण यहां दिखाई देंगे।',
  
  translation: 'अनुवाद:',
  ready: 'तैयार',
  live: 'लाइव',
  connecting: 'कनेक्ट हो रहा है...',
  idle: 'निष्क्रिय',
  paused: 'रुका हुआ',
  listening: 'सुन रहा है',
  translating: 'अनुवाद हो रहा है',
  stopped: 'रुका हुआ',
  off: 'बंद',
  volume: 'वॉल्यूम',
  
  dragDropFiles: 'फ़ाइलें खींचें और छोड़ें या',
  browse: 'ब्राउज़ करें',
  supportedFormats: 'समर्थित प्रारूप: PDF',
  noDocumentsYet: 'अभी तक कोई दस्तावेज़ अपलोड नहीं',
  uploadMaterials: 'स्मार्ट उद्धरण के लिए पाठ्य सामग्री अपलोड करें',
  processing: 'प्रोसेसिंग...',
  
  questionTranslation: 'प्रश्न अनुवाद',
  typeQuestion: 'अपनी भाषा में अपना प्रश्न लिखें...',
  translate: 'अनुवाद करें',
  detected: 'पहचाना गया:',
  history: 'इतिहास',
  clear: 'साफ़ करें',
  noTranslationsYet: 'अभी तक कोई अनुवाद नहीं',
  speak: 'बोलें',
  copy: 'कॉपी करें',
  copied: 'कॉपी हो गया!',
  
  createNewFolder: 'नया फ़ोल्डर बनाएं',
  folderName: 'फ़ोल्डर का नाम',
  cancel: 'रद्द करें',
  create: 'बनाएं',
  startNewSession: 'नया सत्र शुरू करें',
  sessionName: 'सत्र का नाम',
  targetLanguage: 'लक्ष्य भाषा',
  startSession: 'सत्र शुरू करें',
  
  endSessionConfirm: 'सत्र समाप्त करें?',
  endSessionWarning: 'चेतावनी: एक बार सत्र समाप्त होने पर, आप नई ट्रांसक्रिप्शन रिकॉर्ड नहीं कर पाएंगे। यह क्रिया पूर्ववत नहीं की जा सकती।',
  generateNotesQuestion: 'क्या आप ट्रांसक्रिप्शन से संरचित नोट्स बनाना चाहेंगे, या केवल ट्रांसक्रिप्ट सहेजना चाहेंगे?',
  saveTranscriptOnly: 'केवल ट्रांसक्रिप्ट सहेजें',
  endAndGenerateNotes: 'समाप्त करें और नोट्स बनाएं',
  
  lectureNotes: 'व्याख्यान नोट्स',
  viewTranscript: 'ट्रांसक्रिप्ट देखें',
  viewNotes: 'नोट्स देखें',
  
  transcribing: 'ट्रांसक्राइब हो रहा है',
  
  english: 'अंग्रेज़ी',
  chinese: 'चीनी (मंदारिन)',
  hindi: 'हिंदी',
  spanish: 'स्पेनिश',
  french: 'फ़्रेंच',
  bengali: 'बंगाली',
};

// Spanish translations
const es: Translations = {
  lectureLens: 'LectureLens',
  settings: 'Configuración',
  help: 'Ayuda',
  
  welcomeBack: 'Bienvenido de nuevo',
  subjects: 'Materias',
  yourBaseLanguage: 'Tu idioma base:',
  addFolder: 'Agregar carpeta',
  noFoldersYet: 'Aún no hay carpetas',
  createFolder: 'Crear carpeta',
  sessions: 'sesiones',
  
  active: 'Activo',
  sessionEnded: 'Sesión finalizada',
  endSession: 'Finalizar sesión',
  documents: 'Documentos',
  liveTranscription: 'Transcripción en vivo',
  citations: 'Citas',
  citationsEmptyMessage: 'Las citas de tus materiales del curso aparecerán aquí a medida que avance la clase.',
  
  translation: 'Traducción:',
  ready: 'Listo',
  live: 'En vivo',
  connecting: 'Conectando...',
  idle: 'Inactivo',
  paused: 'Pausado',
  listening: 'Escuchando',
  translating: 'Traduciendo',
  stopped: 'Detenido',
  off: 'Apagado',
  volume: 'Volumen',
  
  dragDropFiles: 'Arrastra y suelta archivos o',
  browse: 'Explorar',
  supportedFormats: 'Formatos admitidos: PDF',
  noDocumentsYet: 'Aún no se han subido documentos',
  uploadMaterials: 'Sube materiales del curso para citas inteligentes',
  processing: 'Procesando...',
  
  questionTranslation: 'Traducción de preguntas',
  typeQuestion: 'Escribe tu pregunta en tu idioma...',
  translate: 'Traducir',
  detected: 'Detectado:',
  history: 'Historial',
  clear: 'Limpiar',
  noTranslationsYet: 'Aún no hay traducciones',
  speak: 'Hablar',
  copy: 'Copiar',
  copied: '¡Copiado!',
  
  createNewFolder: 'Crear nueva carpeta',
  folderName: 'Nombre de la carpeta',
  cancel: 'Cancelar',
  create: 'Crear',
  startNewSession: 'Iniciar nueva sesión',
  sessionName: 'Nombre de la sesión',
  targetLanguage: 'Idioma de destino',
  startSession: 'Iniciar sesión',
  
  endSessionConfirm: '¿Finalizar sesión?',
  endSessionWarning: 'Advertencia: Una vez que finalices la sesión, ya no podrás grabar nuevas transcripciones. Esta acción no se puede deshacer.',
  generateNotesQuestion: '¿Te gustaría generar notas estructuradas de la transcripción, o solo guardar la transcripción?',
  saveTranscriptOnly: 'Solo guardar transcripción',
  endAndGenerateNotes: 'Finalizar y generar notas',
  
  lectureNotes: 'Notas de clase',
  viewTranscript: 'Ver transcripción',
  viewNotes: 'Ver notas',
  
  transcribing: 'Transcribiendo',
  
  english: 'Inglés',
  chinese: 'Chino (Mandarín)',
  hindi: 'Hindi',
  spanish: 'Español',
  french: 'Francés',
  bengali: 'Bengalí',
};

// French translations
const fr: Translations = {
  lectureLens: 'LectureLens',
  settings: 'Paramètres',
  help: 'Aide',
  
  welcomeBack: 'Bon retour',
  subjects: 'Matières',
  yourBaseLanguage: 'Votre langue de base :',
  addFolder: 'Ajouter un dossier',
  noFoldersYet: 'Pas encore de dossiers',
  createFolder: 'Créer un dossier',
  sessions: 'sessions',
  
  active: 'Actif',
  sessionEnded: 'Session terminée',
  endSession: 'Terminer la session',
  documents: 'Documents',
  liveTranscription: 'Transcription en direct',
  citations: 'Citations',
  citationsEmptyMessage: 'Les citations de vos supports de cours apparaîtront ici au fur et à mesure du cours.',
  
  translation: 'Traduction :',
  ready: 'Prêt',
  live: 'En direct',
  connecting: 'Connexion...',
  idle: 'Inactif',
  paused: 'En pause',
  listening: 'Écoute',
  translating: 'Traduction',
  stopped: 'Arrêté',
  off: 'Éteint',
  volume: 'Volume',
  
  dragDropFiles: 'Glissez-déposez des fichiers ou',
  browse: 'Parcourir',
  supportedFormats: 'Formats supportés : PDF',
  noDocumentsYet: 'Aucun document téléchargé',
  uploadMaterials: 'Téléchargez des supports de cours pour des citations intelligentes',
  processing: 'Traitement...',
  
  questionTranslation: 'Traduction de question',
  typeQuestion: 'Tapez votre question dans votre langue...',
  translate: 'Traduire',
  detected: 'Détecté :',
  history: 'Historique',
  clear: 'Effacer',
  noTranslationsYet: 'Pas encore de traductions',
  speak: 'Parler',
  copy: 'Copier',
  copied: 'Copié !',
  
  createNewFolder: 'Créer un nouveau dossier',
  folderName: 'Nom du dossier',
  cancel: 'Annuler',
  create: 'Créer',
  startNewSession: 'Démarrer une nouvelle session',
  sessionName: 'Nom de la session',
  targetLanguage: 'Langue cible',
  startSession: 'Démarrer la session',
  
  endSessionConfirm: 'Terminer la session ?',
  endSessionWarning: 'Attention : Une fois la session terminée, vous ne pourrez plus enregistrer de nouvelles transcriptions. Cette action est irréversible.',
  generateNotesQuestion: 'Voulez-vous générer des notes structurées à partir de la transcription, ou seulement sauvegarder la transcription ?',
  saveTranscriptOnly: 'Sauvegarder uniquement la transcription',
  endAndGenerateNotes: 'Terminer et générer des notes',
  
  lectureNotes: 'Notes de cours',
  viewTranscript: 'Voir la transcription',
  viewNotes: 'Voir les notes',
  
  transcribing: 'Transcription en cours',
  
  english: 'Anglais',
  chinese: 'Chinois (Mandarin)',
  hindi: 'Hindi',
  spanish: 'Espagnol',
  french: 'Français',
  bengali: 'Bengali',
};

// All translations
const translations: Record<LanguageCode, Translations> = {
  en,
  zh,
  hi,
  es,
  fr,
};

interface LanguageState {
  language: LanguageCode;
  t: Translations;
  setLanguage: (lang: LanguageCode) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'en',
      t: translations.en,
      setLanguage: (lang) => set({ language: lang, t: translations[lang] }),
    }),
    {
      name: 'lecturelens-language',
    }
  )
);

// Helper to get language name
export const getLanguageName = (code: LanguageCode, t: Translations): string => {
  switch (code) {
    case 'en': return t.english;
    case 'zh': return t.chinese;
    case 'hi': return t.hindi;
    case 'es': return t.spanish;
    case 'fr': return t.french;
    default: return t.english;
  }
};

// Available languages for selection
export const availableLanguages: { code: LanguageCode; nativeName: string }[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'zh', nativeName: '中文' },
  { code: 'hi', nativeName: 'हिन्दी' },
  { code: 'es', nativeName: 'Español' },
  { code: 'fr', nativeName: 'Français' },
];
