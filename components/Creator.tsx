import React, { useState, useRef, useEffect, useMemo } from 'react';
import { LoaderIcon, CameraIcon, PlusIcon, SparklesIcon, BrainIcon } from './Icons';
import { extractVocabulary, generateCardDetails, getOrGenerateImage } from '../services/geminiService';
import { Flashcard, Difficulty, VocabularyItem, Folder } from '../types';

// Use standard UUIDs for database compatibility
const generateId = () => self.crypto.randomUUID();

const TRIVIA_FACTS = [
    { title: "Лиссабон старше Рима", text: "Столица Португалии на 4 века старше Рима. Это одна из старейших столиц Европы." },
    { title: "Звучание языка", text: "Европейский португальский часто сравнивают со славянскими языками из-за сильной редукции гласных и шипящих звуков." },
    { title: "Азулежу", text: "Знаменитая португальская плитка 'azulejo' пришла не из Европы, а имеет арабские корни (от слова 'az-zulayj' — полированный камень)." },
    { title: "Самый длинный мост", text: "Мост Васко да Гама в Лиссабоне — самый длинный мост в Европе (17,2 км)." },
    { title: "Ту vs Восэ", text: "В Португалии 'Tu' используется только с близкими. С незнакомцами используют 'Você' или вообще опускают местоимение, используя форму 3-го лица." },
    { title: "Кофе", text: "Португальцы пьют 'bica' (эспрессо) по 3-5 раз в день. Это важная часть социальной жизни." },
    { title: "Фаду", text: "Португальский музыкальный жанр Фаду внесен в список культурного наследия ЮНЕСКО. Это песни о судьбе и тоске (saudade)." },
    { title: "Окончание -ão", text: "Носовое окончание '-ão' — кошмар для иностранцев, но оно делает язык невероятно мелодичным." },
    { title: "Пробка", text: "Португалия производит около 50% всей пробки в мире. Пробковые дубы охраняются законом." },
    { title: "Старейший союз", text: "Союз между Португалией и Англией (1373 год) считается старейшим действующим дипломатическим альянсом в мире." },
    { title: "Бакаляу", text: "Говорят, у португальцев есть 365 рецептов приготовления трески (bacalhau) — по одному на каждый день года." },
    { title: "Книжный магазин", text: "Livraria Bertrand в Лиссабоне — старейший действующий книжный магазин в мире, открытый в 1732 году." },
    { title: "Зеленое вино", text: "Vinho Verde ('зеленое вино') существует только в Португалии. Название означает, что вино молодое, а не цвет напитка." },
    { title: "Западный край", text: "Мыс Рока (Cabo da Roca) — самая западная точка континентальной Европы." },
    { title: "Сладости", text: "Большинство португальских десертов создали монахини. Они использовали яичные желтки, оставшиеся после накрахмаливания ряс белками." },
    { title: "Паштел-де-ната", text: "Рецепт знаменитых пирожных из Белема держится в строжайшем секрете с 1837 года." },
    { title: "Обед — это святое", text: "Обед в Португалии часто длится 1.5–2 часа. Обсуждать дела во время еды не принято, время для наслаждения." },
    { title: "Имена", text: "В Португалии существует официальный список разрешенных имен. Назвать ребенка нестандартным именем очень сложно." },
    { title: "Тротуар", text: "Calçada Portuguesa — традиционная мостовая из черно-белых камней, выложенных узорами. Красиво, но скользко в дождь!" },
    { title: "Европейский vs Бразильский", text: "Европейский вариант более 'закрытый' и быстрый. Бразильцы часто говорят, что не понимают португальцев без субтитров." },
    { title: "Жестикуляция", text: "Потирание мочки уха в Португалии означает, что еда очень вкусная." },
    { title: "Галисийский язык", text: "Португальский и галисийский (на севере Испании) имеют общие корни и очень похожи." },
    { title: "Полгода лета", text: "В регионе Алгарве солнце светит более 3000 часов в год — это один из самых солнечных регионов Европы." },
    { title: "Серфинг", text: "В Назаре фиксируют самые большие волны в мире. Сюда едут серферы-экстремалы со всей планеты." },
    { title: "Всегда 'Bom dia'", text: "Приветствовать продавцов, водителей и прохожих — обязательная часть этикета." },
    { title: "Кофе 'Шею'", text: "Если вы хотите полную чашку кофе, просите 'café cheio', иначе вам нальют классическую половину." },
    { title: "Саудаде", text: "Слово 'Saudade' непереводимо. Это смесь тоски, ностальгии, любви и ощущения утраты чего-то дорогого." },
    { title: "Желтый трамвай", text: "Трамвай №28 в Лиссабоне — не просто транспорт, а символ города, проходящий через самые старые районы." },
    { title: "Фатима", text: "Город Фатима — одно из главных мест паломничества католиков в мире." },
    { title: "Университет Коимбры", text: "Один из старейших университетов Европы. Студенты до сих пор носят черные мантии (как в Гарри Поттере)." },
    { title: "Портвейн", text: "Настоящий портвейн производится только в долине реки Дору на севере Португалии." },
    { title: "Мадейра", text: "На Мадейре есть уникальный лес Лаурисилва, сохранившийся с третичного периода." },
    { title: "Океанариум", text: "Лиссабонский океанариум — один из крупнейших в мире и лучший в Европе." },
    { title: "Поздний ужин", text: "Ужинать садятся поздно, часто после 20:00 или даже 21:00." },
    { title: "Хлеб", text: "Хлеб подают к каждому приему пищи. Отказаться от корзинки с хлебом в ресторане — нормально, если не хотите платить." },
    { title: "Рыба", text: "Португальцы потребляют больше всего рыбы на душу населения в ЕС." },
    { title: "Гвоздики", text: "Революция 1974 года названа 'Революцией гвоздик', так как прошла практически бескровно." },
    { title: "Лузофония", text: "Португальский — официальный язык в 9 странах на 4 континентах." },
    { title: "Шипящий S", text: "В конце слога буква S читается как 'ш'. Именно это придает речи характерное звучание." },
    { title: "Нет слова 'Стоп'", text: "На дорожных знаках в Португалии написано 'PARE', а не 'STOP'." },
    { title: "Семья", text: "Воскресные обеды с большой семьей — нерушимая традиция для многих португальцев." }
];

interface Props {
  onCardsCreated: (cards: Flashcard[]) => void;
  onCancel: () => void;
  folders: Folder[];
}

const Creator: React.FC<Props> = ({ onCardsCreated, onCancel, folders }) => {
  const [step, setStep] = useState<'input' | 'selection' | 'generating'>('input');
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [wordCount, setWordCount] = useState(5);
  
  // Organization
  const [selectedFolderId, setSelectedFolderId] = useState<string>('default');
  const [tagsInput, setTagsInput] = useState('');

  const [extractedItems, setExtractedItems] = useState<VocabularyItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  // Gamification state - Start with a random fact
  const [currentFactIndex, setCurrentFactIndex] = useState(() => Math.floor(Math.random() * TRIVIA_FACTS.length));

  // Deduplicate folders by name to prevent repeated options in dropdown
  const uniqueFolders = useMemo(() => {
      const seen = new Set<string>();
      return folders.filter(f => {
          const isDuplicate = seen.has(f.name);
          seen.add(f.name);
          return !isDuplicate;
      });
  }, [folders]);

  useEffect(() => {
      isMounted.current = true;
      return () => { isMounted.current = false; };
  }, []);

  // Rotate trivia facts
  useEffect(() => {
      let interval: any;
      if (step === 'generating') {
          interval = setInterval(() => {
              setCurrentFactIndex(prev => (prev + 1) % TRIVIA_FACTS.length);
          }, 6000); // 6 seconds per fact
      }
      return () => clearInterval(interval);
  }, [step]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (mode === 'text' && !textInput.trim()) return;
    if (mode === 'image' && !selectedImage) return;

    setIsLoading(true);
    setLoadingStatus(`Анализируем и ищем топ ${wordCount} слов...`);
    try {
        let items: VocabularyItem[] = [];

        if (mode === 'image' && selectedImage) {
             const base64Data = selectedImage.split(',')[1];
             const mimeType = selectedImage.split(';')[0].split(':')[1];
             items = await extractVocabulary({ imageBase64: base64Data, mimeType }, 'image', wordCount);
        } else {
             items = await extractVocabulary(textInput, 'text', wordCount);
        }
        
        // Filter invalid items
        items = items.filter(item => item && item.word && item.translation);

        if (isMounted.current) {
            setExtractedItems(items);
            const initialSet = new Set<number>();
            items.forEach((_, i) => initialSet.add(i));
            setSelectedItems(initialSet);
            setStep('selection');
        }
    } catch (error) {
        console.error("Analysis error:", error);
        alert("Не удалось проанализировать. Попробуйте еще раз.");
    } finally {
        if (isMounted.current) setIsLoading(false);
    }
  };

  const toggleSelection = (index: number) => {
      const newSet = new Set(selectedItems);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      setSelectedItems(newSet);
  };

  const handleGenerateCards = async () => {
      if (selectedItems.size === 0) return;

      setStep('generating');
      setIsLoading(true);
      const newCards: Flashcard[] = [];
      const indices = Array.from(selectedItems);
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

      try {
          for (let i = 0; i < indices.length; i++) {
              if (!isMounted.current) break; 

              const index = indices[i];
              const item = extractedItems[index];
              
              // Dynamic status update
              const actions = ["Рисуем иллюстрацию...", "Сочиняем примеры...", "Подбираем грамматику...", "Записываем озвучку..."];
              setLoadingStatus(`${actions[i % actions.length]} (${i + 1}/${indices.length})`);

              const details = await generateCardDetails(item.word);
              
              // Image Logic using Gemini (with Global Cache)
              let finalImageUrl = undefined;
              if (details.visualPrompt) {
                  const styleSuffix = ", minimalist flat vector art, simple illustration, white background, high contrast, clean lines, no text";
                  const fullPrompt = details.visualPrompt + styleSuffix;
                  try {
                      // Use smart function that checks cache
                      finalImageUrl = await getOrGenerateImage(fullPrompt, item.word);
                  } catch (imgErr) {
                      console.warn("Image generation failed:", imgErr);
                  }
              }

              const card: Flashcard = {
                  id: generateId(),
                  folderIds: [selectedFolderId],
                  tags: tags,
                  originalTerm: item.word,
                  translation: item.translation,
                  definition: details.definition || 'Definition unavailable',
                  examples: details.examples || [],
                  grammarNotes: details.grammarNotes,
                  conjugation: details.conjugation,
                  imageUrl: finalImageUrl,
                  imagePrompt: details.visualPrompt,
                  frequency: details.frequency,
                  difficulty: Difficulty.New,
                  nextReviewDate: Date.now(),
                  interval: 0,
                  easeFactor: 2.5,
                  createdAt: Date.now()
              };
              newCards.push(card);
          }

          if (isMounted.current) {
              onCardsCreated(newCards);
          }
      } catch (error) {
          console.error(error);
          alert("Ошибка при генерации. Часть карточек могла быть не сохранена.");
          if (newCards.length > 0 && isMounted.current) {
              onCardsCreated(newCards);
          } else if (isMounted.current) {
              setStep('selection');
          }
      } finally {
          if (isMounted.current) setIsLoading(false);
      }
  };

  // Progress percentage
  const progressPercent = selectedItems.size > 0 
    ? Math.min(100, Math.round((TRIVIA_FACTS.length / selectedItems.size) * 100)) // Fake progress for demo, in reality we'd track i
    : 0;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 transition-colors">
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 sticky top-0 z-10">
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">Новые карточки</h2>
        {step !== 'generating' && (
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">Отмена</button>
        )}
      </div>

      <div className="flex-1 p-6 overflow-y-auto">
        
        {/* STEP 1: INPUT */}
        {step === 'input' && (
            <>
                <div className="flex gap-2 mb-6 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <button 
                        onClick={() => setMode('text')}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${mode === 'text' ? 'bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Текст
                    </button>
                    <button 
                        onClick={() => setMode('image')}
                        className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${mode === 'image' ? 'bg-white dark:bg-slate-600 shadow-sm text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                        Фото
                    </button>
                </div>

                <div className="mb-6 space-y-4 border p-4 rounded-xl border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Сколько слов найти?</label>
                        <div className="flex items-center gap-3">
                            <input 
                                type="range" 
                                min="1" 
                                max="20" 
                                value={wordCount} 
                                onChange={(e) => setWordCount(parseInt(e.target.value))}
                                className="flex-1 accent-emerald-600"
                            />
                            <span className="font-bold text-slate-800 dark:text-white w-8 text-center">{wordCount}</span>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Папка</label>
                        <select 
                            value={selectedFolderId} 
                            onChange={(e) => setSelectedFolderId(e.target.value)}
                            className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                        >
                            <option value="default">Без категории</option>
                            {uniqueFolders.map(f => (
                                <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Теги (через запятую)</label>
                        <input 
                            type="text" 
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            placeholder="еда, глаголы, путешествия"
                            className="w-full p-2 rounded border border-slate-200 dark:border-slate-600 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none"
                        />
                    </div>
                </div>

                {mode === 'text' ? (
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Текст для анализа</label>
                        <textarea 
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder="Вставьте текст, фразу или даже одно слово — ИИ найдет перевод и создаст контекст для изучения..."
                            className="w-full h-32 p-4 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400"
                        />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Загрузить фото</label>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors relative overflow-hidden bg-white dark:bg-slate-800"
                        >
                            {selectedImage ? (
                                <img src={selectedImage} alt="Preview" className="w-full h-full object-contain" />
                            ) : (
                                <>
                                    <CameraIcon className="w-12 h-12 text-slate-300 dark:text-slate-500 mb-2" />
                                    <p className="text-slate-500 dark:text-slate-400 text-sm">Нажмите для загрузки</p>
                                </>
                            )}
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        </div>
                    </div>
                )}

                <div className="mt-6">
                     <button 
                        onClick={handleAnalyze}
                        disabled={isLoading || (mode === 'text' && !textInput) || (mode === 'image' && !selectedImage)}
                        className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700"
                    >
                        {isLoading ? <LoaderIcon className="animate-spin w-5 h-5" /> : 'Анализировать'}
                    </button>
                    {isLoading && <p className="text-center text-xs text-slate-500 mt-2">{loadingStatus}</p>}
                </div>
            </>
        )}

        {/* STEP 2: SELECTION */}
        {step === 'selection' && (
            <div>
                <h3 className="font-bold text-slate-800 dark:text-white mb-4">Найдено слов: {extractedItems.length}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    Выберите слова для создания карточек в папку "<strong>{selectedFolderId === 'default' ? 'Без категории' : folders.find(f=>f.id===selectedFolderId)?.name}</strong>".
                </p>
                <div className="space-y-2">
                    {extractedItems.map((item, idx) => (
                        <div 
                            key={idx}
                            onClick={() => toggleSelection(idx)}
                            className={`p-3 rounded-lg border cursor-pointer flex items-start gap-3 transition-all ${selectedItems.has(idx) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                            <div className={`w-5 h-5 rounded border flex items-center justify-center mt-0.5 ${selectedItems.has(idx) ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-500'}`}>
                                {selectedItems.has(idx) && <PlusIcon className="w-3 h-3 rotate-45" />} 
                            </div>
                            <div>
                                <p className="font-bold text-slate-800 dark:text-white">{item.word} <span className="font-normal text-slate-500 dark:text-slate-400">- {item.translation}</span></p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{item.context}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="mt-6 sticky bottom-0 bg-white dark:bg-slate-800 pt-4">
                    <button 
                        onClick={handleGenerateCards}
                        disabled={selectedItems.size === 0}
                        className="w-full py-3.5 bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 disabled:opacity-50 hover:bg-emerald-700"
                    >
                        Создать карточки ({selectedItems.size})
                    </button>
                </div>
            </div>
        )}

        {/* STEP 3: GENERATING WITH GAMIFICATION */}
        {step === 'generating' && (
             <div className="h-full flex flex-col items-center justify-center relative">
                
                {/* Visual Animation */}
                <div className="relative mb-10 w-32 h-32">
                    <div className="absolute inset-0 border-4 border-slate-100 dark:border-slate-700 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <SparklesIcon className="w-10 h-10 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                    </div>
                </div>

                {/* Status Text */}
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">{loadingStatus}</h3>
                <p className="text-slate-400 dark:text-slate-500 text-sm mb-8">ИИ создает контент для вас...</p>

                {/* Trivia Card */}
                <div className="w-full max-w-sm bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-2xl p-6 relative overflow-hidden animate-in fade-in slide-in-from-bottom duration-700">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <BrainIcon className="w-24 h-24 text-indigo-900 dark:text-indigo-100" />
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3 text-indigo-700 dark:text-indigo-300">
                            <span className="bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Факт дня</span>
                        </div>
                        <h4 className="font-bold text-slate-800 dark:text-white mb-2 text-lg">
                            {TRIVIA_FACTS[currentFactIndex].title}
                        </h4>
                        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                            {TRIVIA_FACTS[currentFactIndex].text}
                        </p>
                    </div>

                    {/* Progress dots for facts */}
                    <div className="flex gap-1 mt-4 justify-center">
                        {TRIVIA_FACTS.map((_, i) => (
                             // Only show 5 dots centered around current
                             (i >= currentFactIndex - 2 && i <= currentFactIndex + 2) ? (
                                <div 
                                    key={i} 
                                    className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentFactIndex ? 'bg-indigo-500 dark:bg-indigo-400' : 'bg-indigo-200 dark:bg-indigo-800'}`}
                                />
                             ) : null
                        ))}
                    </div>
                </div>
             </div>
        )}

      </div>
    </div>
  );
};

export default Creator;