import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import './Welcome.css'
import Papa from 'papaparse'
import { transliterateGreek } from '../../utils/greekTransliterate'

// Full book name mapping
const BOOK_NAMES: Record<string, string> = {
    Mat: 'Matthew', Mk: 'Mark', Lk: 'Luke', Jn: 'John', Ac: 'Acts',
    Ro: 'Romans', '1Co': '1 Corinthians', '2Co': '2 Corinthians',
    Ga: 'Galatians', Eph: 'Ephesians', Php: 'Philippians', Col: 'Colossians',
    '1Th': '1 Thessalonians', '2Th': '2 Thessalonians',
    '1Ti': '1 Timothy', '2Ti': '2 Timothy', Tit: 'Titus', Phm: 'Philemon',
    Heb: 'Hebrews', Jas: 'James', '1Pe': '1 Peter', '2Pe': '2 Peter',
    '1Jn': '1 John', '2Jn': '2 John', '3Jn': '3 John', Jud: 'Jude', Re: 'Revelation',
}

const PRACTICE_STORAGE_KEY = 'practiceResultsByVerse'

export const Welcome: React.FC = () => {
    const [data, setData] = useState<any[]>([])
    const [dataError, setDataError] = useState<string | null>(null)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isNavOpen, setIsNavOpen] = useState(false)
    const [isLightMode, setIsLightMode] = useState(false)
    const [fontScale, setFontScale] = useState(1)
    const fontMin = 0.85
    const fontMax = 1.5
    const fontStep = 0.05
    const [practiceLang, setPracticeLang] = useState<string | null>(null)
    const [practiceIndex, setPracticeIndex] = useState(0)
    const [practiceResults, setPracticeResults] = useState<Record<string, Record<number, boolean>>>({
        'en-US': {},
        'el-GR': {},
    })
    const [sttAvailable, setSttAvailable] = useState(true)
    const [isAutoContinue, setIsAutoContinue] = useState(false)
    const [speakingLang, setSpeakingLang] = useState<string | null>(null)
    const [speechRate, setSpeechRate] = useState<number>(1)
    const [activeWordIndex, setActiveWordIndex] = useState<number>(-1)
    const [activeOtherWordIndex, setActiveOtherWordIndex] = useState<number>(-1)
    const spokenWordsRef = useRef<string[]>([])
    const otherWordsRef = useRef<string[]>([])
    const [isPaused, setIsPaused] = useState(false)
    const currentLangRef = useRef<string | null>(null)
    const currentTextRef = useRef<string>('')
    const currentOtherTextRef = useRef<string>('')
    const speechSessionIdRef = useRef(0)
    const isAutoContinueRef = useRef(false)
    const autoAdvanceRef = useRef(false)
    const recognitionRef = useRef<any>(null)
    const practiceWordsRef = useRef<string[]>([])
    const practiceIndexRef = useRef(0)
    const isPracticeHydratingRef = useRef(false)

    const currentVerse = data[currentIndex]

    const getVerseKey = useCallback((verse: any, lang: string) => {
        return `${verse?.Book}:${verse?.Chapter}:${verse?.Verse}:${lang}`
    }, [])

    const readPracticeStore = useCallback(() => {
        if (typeof window === 'undefined') return {}
        try {
            const raw = window.localStorage.getItem(PRACTICE_STORAGE_KEY)
            if (!raw) return {}
            const parsed = JSON.parse(raw)
            return typeof parsed === 'object' && parsed !== null ? parsed : {}
        } catch {
            return {}
        }
    }, [])

    const writePracticeStore = useCallback((store: Record<string, Record<number, boolean>>) => {
        if (typeof window === 'undefined') return
        try {
            window.localStorage.setItem(PRACTICE_STORAGE_KEY, JSON.stringify(store))
        } catch {
            // Ignore storage failures (private mode, quota, etc.)
        }
    }, [])

    useEffect(() => {
        isAutoContinueRef.current = isAutoContinue
    }, [isAutoContinue])

    useEffect(() => {
        practiceIndexRef.current = practiceIndex
    }, [practiceIndex])

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) {
            setSttAvailable(false)
        }
    }, [])

    useEffect(() => {
        const csvUrl = `${process.env.PUBLIC_URL}/aligned_kjv_greek.csv`
        fetch(csvUrl)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load CSV (${response.status})`)
                }
                return response.text()
            })
            .then((csvText) => {
                Papa.parse(csvText, {
                    header: true,
                    complete: (result) => {
                        const filtered = result.data.filter(
                            (row: any) => row.verse && row.Text
                        )
                        setData(filtered)
                        setDataError(null)
                    },
                })
            })
            .catch((error) => {
                const message = error instanceof Error ? error.message : 'Failed to load data'
                setDataError(message)
            })
    }, [])

    useEffect(() => {
        if (!currentVerse) return
        const store = readPracticeStore()
        const enKey = getVerseKey(currentVerse, 'en-US')
        const elKey = getVerseKey(currentVerse, 'el-GR')
        isPracticeHydratingRef.current = true
        setPracticeResults({
            'en-US': store[enKey] || {},
            'el-GR': store[elKey] || {},
        })
        setPracticeIndex(0)
    }, [currentVerse, getVerseKey, readPracticeStore])

    useEffect(() => {
        if (!currentVerse) return
        if (isPracticeHydratingRef.current) {
            isPracticeHydratingRef.current = false
            return
        }
        const store = readPracticeStore()
        const enKey = getVerseKey(currentVerse, 'en-US')
        const elKey = getVerseKey(currentVerse, 'el-GR')

        const enResults = practiceResults['en-US'] || {}
        const elResults = practiceResults['el-GR'] || {}

        if (Object.keys(enResults).length === 0) {
            delete store[enKey]
        } else {
            store[enKey] = enResults
        }

        if (Object.keys(elResults).length === 0) {
            delete store[elKey]
        } else {
            store[elKey] = elResults
        }

        writePracticeStore(store)
    }, [currentVerse, getVerseKey, practiceResults, readPracticeStore, writePracticeStore])

    const stopSpeaking = useCallback(() => {
        speechSessionIdRef.current += 1
        window.speechSynthesis.cancel()
        setSpeakingLang(null)
        setIsPaused(false)
        setActiveWordIndex(-1)
        setActiveOtherWordIndex(-1)
        currentLangRef.current = null
    }, [])

    const updateMappedIndex = useCallback((wordIndex: number) => {
        const spokenWords = spokenWordsRef.current
        const otherWords = otherWordsRef.current
        if (spokenWords.length === 0) return
        const ratio = otherWords.length / spokenWords.length
        const mappedIndex = Math.min(
            Math.round(wordIndex * ratio),
            otherWords.length - 1
        )
        setActiveOtherWordIndex(mappedIndex)
    }, [])

    const getVoiceForLang = useCallback((lang: string) => {
        const voices = window.speechSynthesis.getVoices()
        return voices.find((voice) => voice.lang.startsWith(lang.split('-')[0]))
    }, [])

    const normalizeWord = useCallback((value: string) => {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^A-Za-z0-9\u0370-\u03FF\u1F00-\u1FFF]+/g, '')
            .toLowerCase()
    }, [])

    const stopPractice = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.onresult = null
            recognitionRef.current.onerror = null
            recognitionRef.current.onend = null
            recognitionRef.current.stop()
            recognitionRef.current = null
        }
        setPracticeLang(null)
        setPracticeIndex(0)
    }, [])

    const resetPracticeResults = useCallback((lang: string) => {
        if (!currentVerse) return
        const store = readPracticeStore()
        const key = getVerseKey(currentVerse, lang)
        delete store[key]
        writePracticeStore(store)
        setPracticeResults((prev) => ({
            ...prev,
            [lang]: {},
        }))
        if (practiceLang === lang) {
            setPracticeIndex(0)
        }
    }, [currentVerse, getVerseKey, practiceLang, readPracticeStore, writePracticeStore])

    const startPractice = useCallback((lang: string, text: string) => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        if (!SpeechRecognition) {
            setSttAvailable(false)
            return
        }

        if (practiceLang === lang) {
            stopPractice()
            return
        }

        stopPractice()
        const words = text.split(/\s+/).filter(Boolean).map((word) => normalizeWord(word))
        practiceWordsRef.current = words
        setPracticeResults((prev) => ({
            ...prev,
            [lang]: {},
        }))
        setPracticeIndex(0)
        setPracticeLang(lang)

        const recognition = new SpeechRecognition()
        recognition.lang = lang
        recognition.continuous = true
        recognition.interimResults = true

        recognition.onresult = (event: any) => {
            let index = practiceIndexRef.current
            const updates: Record<number, boolean> = {}

            for (let i = event.resultIndex; i < event.results.length; i += 1) {
                const result = event.results[i]
                if (!result.isFinal) continue
                const transcript = result[0]?.transcript || ''
                const spoken = transcript.split(/\s+/).filter(Boolean).map((word: string) => normalizeWord(word))
                for (const spokenWord of spoken) {
                    if (index >= practiceWordsRef.current.length) break
                    const target = practiceWordsRef.current[index]
                    const isCorrect = spokenWord === target
                    updates[index] = isCorrect
                    index += 1
                }
            }

            if (Object.keys(updates).length > 0) {
                setPracticeResults((prev) => ({
                    ...prev,
                    [lang]: {
                        ...prev[lang],
                        ...updates,
                    },
                }))
                setPracticeIndex(index)
            }
        }

        recognition.onerror = () => {
            stopPractice()
        }

        recognition.onend = () => {
            if (practiceLang === lang) {
                stopPractice()
            }
        }

        recognitionRef.current = recognition
        recognition.start()
    }, [normalizeWord, practiceLang, stopPractice])

    const getVerseTexts = useCallback((verse: any, lang: string) => {
        if (lang === 'el-GR') {
            return { primary: verse.greek_text, secondary: verse.Text }
        }
        return { primary: verse.Text, secondary: verse.greek_text }
    }, [])

    const startSpeakingFromIndex = useCallback((
        text: string,
        lang: string,
        otherText: string,
        startIndex: number,
        verseIndex?: number
    ) => {
        speechSessionIdRef.current += 1
        const sessionId = speechSessionIdRef.current

        window.speechSynthesis.cancel()

        const spokenWords = text.split(/\s+/).filter(Boolean)
        const otherWords = otherText.split(/\s+/).filter(Boolean)
        if (spokenWords.length === 0) {
            stopSpeaking()
            return
        }
        spokenWordsRef.current = spokenWords
        otherWordsRef.current = otherWords
        currentLangRef.current = lang
        currentTextRef.current = text
        currentOtherTextRef.current = otherText

        const clampedStart = Math.max(0, Math.min(startIndex, spokenWords.length - 1))
        const utterWords = spokenWords.slice(clampedStart)
        const utterText = utterWords.join(' ')
        const baseVerseIndex = verseIndex ?? currentIndex

        const utterance = new SpeechSynthesisUtterance(utterText)
        utterance.lang = lang
        utterance.rate = speechRate
        const voice = getVoiceForLang(lang)
        if (voice) utterance.voice = voice

        setSpeakingLang(lang)
        setIsPaused(false)
        setActiveWordIndex(clampedStart)
        updateMappedIndex(clampedStart)

        utterance.onboundary = (event: SpeechSynthesisEvent) => {
            if (event.name !== 'word') return
            const charIndex = event.charIndex
            let localWordIndex = 0
            let pos = 0
            for (let i = 0; i < utterWords.length; i++) {
                if (pos >= charIndex) {
                    localWordIndex = i
                    break
                }
                pos += utterWords[i].length + 1
                localWordIndex = i + 1
            }
            localWordIndex = Math.min(localWordIndex, utterWords.length - 1)
            const globalIndex = clampedStart + localWordIndex
            setActiveWordIndex(globalIndex)
            updateMappedIndex(globalIndex)
        }

        utterance.onend = () => {
            if (speechSessionIdRef.current !== sessionId) return
            if (isAutoContinueRef.current) {
                const nextIndex = baseVerseIndex + 1
                const nextVerse = data[nextIndex]
                if (nextVerse && nextVerse.Text && nextVerse.greek_text) {
                    const nextTexts = getVerseTexts(nextVerse, lang)
                    autoAdvanceRef.current = true
                    setCurrentIndex(nextIndex)
                    startSpeakingFromIndex(
                        nextTexts.primary,
                        lang,
                        nextTexts.secondary,
                        0,
                        nextIndex
                    )
                    return
                }
            }
            setSpeakingLang(null)
            setIsPaused(false)
            setActiveWordIndex(-1)
            setActiveOtherWordIndex(-1)
            currentLangRef.current = null
        }
        utterance.onerror = () => {
            if (speechSessionIdRef.current !== sessionId) return
            setSpeakingLang(null)
            setIsPaused(false)
            setActiveWordIndex(-1)
            setActiveOtherWordIndex(-1)
            currentLangRef.current = null
        }

        window.speechSynthesis.speak(utterance)
    }, [currentIndex, data, getVoiceForLang, getVerseTexts, speechRate, stopSpeaking, updateMappedIndex])

    const speak = useCallback((text: string, lang: string, otherText: string) => {
        if (speakingLang !== null && speakingLang !== lang) {
            return
        }
        if (speakingLang === lang) {
            stopSpeaking()
            return
        }
        startSpeakingFromIndex(text, lang, otherText, 0, currentIndex)
    }, [currentIndex, speakingLang, startSpeakingFromIndex, stopSpeaking])

    const togglePause = useCallback(() => {
        if (!speakingLang) return
        if (isPaused) {
            const resumeIndex = activeWordIndex >= 0 ? activeWordIndex : 0
            startSpeakingFromIndex(
                currentTextRef.current,
                speakingLang,
                currentOtherTextRef.current,
                resumeIndex,
                currentIndex
            )
        } else {
            window.speechSynthesis.pause()
            setIsPaused(true)
        }
    }, [activeWordIndex, currentIndex, isPaused, speakingLang, startSpeakingFromIndex])

    const speakSingleWord = useCallback((word: string, lang: string) => {
        if (!word) return
        const utterance = new SpeechSynthesisUtterance(word)
        utterance.lang = lang
        utterance.rate = speechRate
        const voice = getVoiceForLang(lang)
        if (voice) utterance.voice = voice
        window.speechSynthesis.speak(utterance)
    }, [getVoiceForLang, speechRate])

    const jumpToWord = useCallback((direction: number) => {
        if (!speakingLang) return
        const words = spokenWordsRef.current
        if (words.length === 0) return

        speechSessionIdRef.current += 1
        window.speechSynthesis.cancel()
        setIsPaused(true)

        const maxIndex = words.length - 1
        const currentIndex = activeWordIndex >= 0 ? activeWordIndex : 0
        const newIndex = Math.max(0, Math.min(maxIndex, currentIndex + direction))
        setActiveWordIndex(newIndex)
        updateMappedIndex(newIndex)
        speakSingleWord(words[newIndex], speakingLang)
    }, [activeWordIndex, speakingLang, speakSingleWord, updateMappedIndex])

    const goToPreviousWord = useCallback(() => {
        jumpToWord(-1)
    }, [jumpToWord])

    const goToNextWord = useCallback(() => {
        jumpToWord(1)
    }, [jumpToWord])

    useEffect(() => {
        if (autoAdvanceRef.current) {
            autoAdvanceRef.current = false
            return
        }
        stopPractice()
        stopSpeaking()
    }, [currentIndex, stopPractice, stopSpeaking])

    // Derived navigation structures
    const { books, chaptersByBook, versesByBookChapter, indexLookup } = useMemo(() => {
        const booksSet = new Set<string>()
        const chaptersMap: Record<string, Set<number>> = {}
        const versesMap: Record<string, Set<number>> = {}
        const lookup: Record<string, number> = {}

        data.forEach((row, idx) => {
            const book = row.Book
            const chapter = parseInt(row.Chapter, 10)
            const verse = parseInt(row.Verse, 10)
            if (!book || isNaN(chapter) || isNaN(verse)) return

            booksSet.add(book)
            if (!chaptersMap[book]) chaptersMap[book] = new Set()
            chaptersMap[book].add(chapter)

            const bcKey = `${book}:${chapter}`
            if (!versesMap[bcKey]) versesMap[bcKey] = new Set()
            versesMap[bcKey].add(verse)

            const bvcKey = `${book}:${chapter}:${verse}`
            if (!(bvcKey in lookup)) lookup[bvcKey] = idx
        })

        const booksArr = Array.from(booksSet)
        const chaptersByBook: Record<string, number[]> = {}
        for (const book of booksArr) {
            chaptersByBook[book] = Array.from(chaptersMap[book] || []).sort((a, b) => a - b)
        }
        const versesByBookChapter: Record<string, number[]> = {}
        for (const key of Object.keys(versesMap)) {
            versesByBookChapter[key] = Array.from(versesMap[key]).sort((a, b) => a - b)
        }

        return { books: booksArr, chaptersByBook, versesByBookChapter, indexLookup: lookup }
    }, [data])

    const selectedBook = currentVerse?.Book || books[0] || ''
    const selectedChapter = currentVerse ? parseInt(currentVerse.Chapter, 10) : 1
    const selectedVerseNum = currentVerse ? parseInt(currentVerse.Verse, 10) : 1

    const handleBookChange = useCallback((newBook: string) => {
        const firstChapter = chaptersByBook[newBook]?.[0] || 1
        const firstVerse = versesByBookChapter[`${newBook}:${firstChapter}`]?.[0] || 1
        const idx = indexLookup[`${newBook}:${firstChapter}:${firstVerse}`]
        if (idx !== undefined) setCurrentIndex(idx)
    }, [chaptersByBook, versesByBookChapter, indexLookup])

    const handleChapterChange = useCallback((newChapter: number) => {
        const firstVerse = versesByBookChapter[`${selectedBook}:${newChapter}`]?.[0] || 1
        const idx = indexLookup[`${selectedBook}:${newChapter}:${firstVerse}`]
        if (idx !== undefined) setCurrentIndex(idx)
    }, [selectedBook, versesByBookChapter, indexLookup])

    const handleVerseChange = useCallback((newVerse: number) => {
        const idx = indexLookup[`${selectedBook}:${selectedChapter}:${newVerse}`]
        if (idx !== undefined) setCurrentIndex(idx)
    }, [selectedBook, selectedChapter, indexLookup])

    const availableChapters = chaptersByBook[selectedBook] || []
    const availableVerses = versesByBookChapter[`${selectedBook}:${selectedChapter}`] || []

    const goToPrevious = () => {
        setCurrentIndex((prev) => Math.max(0, prev - 1))
    }

    const goToNext = () => {
        setCurrentIndex((prev) => Math.min(data.length - 1, prev + 1))
    }

    const renderWords = (text: string, highlightIndex: number, results: Record<number, boolean> = {}) => {
        const words = text.split(/\s+/).filter(Boolean)
        return words.map((word, i) => (
            <span
                key={i}
                className={`word ${i === highlightIndex ? 'word-highlight' : ''} ${results[i] === true ? 'word-correct' : ''} ${results[i] === false ? 'word-incorrect' : ''}`}
            >
                {word}{' '}
            </span>
        ))
    }

    const renderGreekWords = (text: string, highlightIndex: number, results: Record<number, boolean> = {}) => {
        const words = text.split(/\s+/).filter(Boolean)
        return (
            <span className="greek-words-container">
                {words.map((word, i) => (
                    <span
                        key={i}
                        className={`greek-word-group ${i === highlightIndex ? 'word-highlight' : ''} ${results[i] === true ? 'word-correct' : ''} ${results[i] === false ? 'word-incorrect' : ''}`}
                    >
                        <span className="greek-word">{word}</span>
                        <span className="phonetic-word">{transliterateGreek(word)}</span>
                    </span>
                ))}
            </span>
        )
    }

    const isEnglishSpeaking = speakingLang === 'en-US'
    const isGreekSpeaking = speakingLang === 'el-GR'
    const englishHighlight = practiceLang === 'en-US'
        ? practiceIndex
        : isEnglishSpeaking
            ? activeWordIndex
            : isGreekSpeaking
                ? activeOtherWordIndex
                : -1
    const greekHighlight = practiceLang === 'el-GR'
        ? practiceIndex
        : isGreekSpeaking
            ? activeWordIndex
            : isEnglishSpeaking
                ? activeOtherWordIndex
                : -1
    const englishHasResults = Object.keys(practiceResults['en-US'] || {}).length > 0
    const greekHasResults = Object.keys(practiceResults['el-GR'] || {}).length > 0

    return (
        <div className={`App ${isLightMode ? 'theme-light' : 'theme-dark'}`}>
            <header className="app-header">
                <div className="header-brand">
                    <img src="/app-icon.svg" alt="Original Manuscripts" className="header-icon" />
                    <h1>Original Manuscripts</h1>
                </div>
                <div className="header-actions">
                    <button
                        className="theme-toggle"
                        type="button"
                        onClick={() => setIsLightMode((prev) => !prev)}
                        aria-label="Toggle light or dark mode"
                    >
                        <span className="theme-icon" aria-hidden="true">
                            {isLightMode ? '☀️' : '🌙'}
                        </span>
                    </button>
                    <button
                        className="nav-toggle"
                        type="button"
                        aria-label="Toggle navigation"
                        onClick={() => setIsNavOpen((prev) => !prev)}
                    >
                        ☰
                    </button>
                </div>
            </header>
            <div className="app-body">
                <aside className={`side-nav ${isNavOpen ? 'side-nav-open' : ''}`}>
                    <div className="side-nav-section">
                        <div className="side-nav-title">Choose language</div>
                        <button className="side-nav-item side-nav-item-active" type="button">
                            <span className="side-nav-emoji">α</span>
                            Greek
                        </button>
                        <button className="side-nav-item" type="button" disabled>
                            <span className="side-nav-emoji">א</span>
                            Hebrew (coming soon)
                        </button>
                        <button className="side-nav-item" type="button" disabled>
                            <span className="side-nav-emoji">A</span>
                            Latin (coming soon)
                        </button>
                    </div>
                    <div className="side-nav-section">
                        <div className="side-nav-title">Order custom bible</div>
                        <button className="side-nav-item" type="button" disabled>
                            <span className="side-nav-emoji">📖</span>
                            Order custom bible (coming soon)
                        </button>
                    </div>
                    <div className="side-nav-bottom">
                        <div className="font-control">
                            <span className="font-control-label">Text size</span>
                            <div className="font-control-buttons" role="group" aria-label="Adjust verse text size">
                                <button
                                    type="button"
                                    className="font-control-btn"
                                    onClick={() => setFontScale((prev) => Math.max(fontMin, parseFloat((prev - fontStep).toFixed(2))))}
                                    disabled={fontScale <= fontMin}
                                    aria-label="Decrease text size"
                                >
                                    −
                                </button>
                                <span className="font-control-value">{Math.round(fontScale * 100)}%</span>
                                <button
                                    type="button"
                                    className="font-control-btn"
                                    onClick={() => setFontScale((prev) => Math.min(fontMax, parseFloat((prev + fontStep).toFixed(2))))}
                                    disabled={fontScale >= fontMax}
                                    aria-label="Increase text size"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                        <div className="side-nav-footer">
                            Created with ❤️ by <a href="https://originalmanuscripts.com" target="_blank" rel="noopener noreferrer">Original Manuscripts</a>
                        </div>
                    </div>
                </aside>
                <div className="viewer">
                    {dataError ? (
                        <p>{dataError}</p>
                    ) : currentVerse ? (
                        <>
                            <div className="verse-selector">
                                <select
                                    className="selector-dropdown selector-dropdown-book"
                                    value={selectedBook}
                                    onChange={(e) => handleBookChange(e.target.value)}
                                    aria-label="Book"
                                >
                                    {books.map((book) => (
                                        <option key={book} value={book}>
                                            {BOOK_NAMES[book] || book}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className="selector-dropdown selector-dropdown-chapter"
                                    value={selectedChapter}
                                    onChange={(e) => handleChapterChange(parseInt(e.target.value, 10))}
                                    aria-label="Chapter"
                                >
                                    {availableChapters.map((ch) => (
                                        <option key={ch} value={ch}>
                                            Chapter {ch}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    className="selector-dropdown selector-dropdown-verse"
                                    value={selectedVerseNum}
                                    onChange={(e) => handleVerseChange(parseInt(e.target.value, 10))}
                                    aria-label="Verse"
                                >
                                    {availableVerses.map((v) => (
                                        <option key={v} value={v}>
                                            Verse {v}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="verse-cards">
                                <div className={`verse-card ${speakingLang === 'en-US' ? 'verse-card-speaking' : ''} ${practiceLang === 'en-US' ? 'verse-card-practicing' : ''}`}>
                                    <div className="verse-card-topbar">
                                        <h2>KJV</h2>
                                        <div className="practice-actions">
                                            <button
                                                className={`practice-btn ${practiceLang === 'en-US' ? 'practice-btn-active' : ''}`}
                                                onClick={() => startPractice('en-US', currentVerse.Text)}
                                                disabled={!sttAvailable || speakingLang !== null || (practiceLang !== null && practiceLang !== 'en-US')}
                                                title="Practice pronunciation"
                                            >
                                                <span className="practice-emoji" aria-hidden="true">🎙️</span>
                                                {practiceLang === 'en-US' ? 'STOP' : 'PRACTICE'}
                                            </button>
                                            <button
                                                className="practice-reset-btn"
                                                type="button"
                                                onClick={() => resetPracticeResults('en-US')}
                                                disabled={!englishHasResults}
                                                title="Reset practice highlights"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                    <p className="verse-text" style={{ fontSize: `${1.1 * fontScale}rem` }}>
                                        {renderWords(currentVerse.Text, englishHighlight, practiceResults['en-US'])}
                                    </p>
                                    <div className="verse-card-footer">
                                        <div className="audio-controls">
                                            {speakingLang === 'en-US' && (
                                                <div className="audio-side audio-side-left">
                                                    <label className="continue-toggle">
                                                        <input
                                                            type="checkbox"
                                                            checked={isAutoContinue}
                                                            onChange={(e) => setIsAutoContinue(e.target.checked)}
                                                        />
                                                        <span>Auto-next</span>
                                                    </label>
                                                    <button
                                                        className="control-btn"
                                                        onClick={goToPreviousWord}
                                                        disabled={activeWordIndex <= 0}
                                                        title="Previous word"
                                                    >
                                                        ⏮
                                                    </button>
                                                    <button
                                                        className="control-btn play-pause-btn"
                                                        onClick={togglePause}
                                                        title={isPaused ? 'Resume' : 'Pause'}
                                                    >
                                                        {isPaused ? '▶' : '⏸'}
                                                    </button>
                                                    <button
                                                        className="control-btn"
                                                        onClick={goToNextWord}
                                                        disabled={activeWordIndex >= spokenWordsRef.current.length - 1}
                                                        title="Next word"
                                                    >
                                                        ⏭
                                                    </button>
                                                </div>
                                            )}
                                            <button
                                                className={`speak-btn ${speakingLang === 'en-US' ? 'speaking' : ''}`}
                                                onClick={() => speak(currentVerse.Text, 'en-US', currentVerse.greek_text)}
                                                disabled={practiceLang !== null || (speakingLang !== null && speakingLang !== 'en-US')}
                                                title="Listen in English"
                                            >
                                                <span className="speak-icon">
                                                    {speakingLang === 'en-US' ? '⏹' : '🔊'}
                                                </span>
                                                <span className="speak-label">
                                                    {speakingLang === 'en-US' ? 'Stop' : 'Listen'}
                                                </span>
                                            </button>
                                            <div className="audio-side audio-side-right">
                                                <span className="inline-speed-label">Speed</span>
                                                {[0.5, 1, 1.5].map((rate) => (
                                                    <button
                                                        key={rate}
                                                        className={`speed-btn ${speechRate === rate ? 'speed-btn-active' : ''}`}
                                                        onClick={() => setSpeechRate(rate)}
                                                        disabled={speakingLang !== null}
                                                    >
                                                        {rate}×
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={`verse-card ${speakingLang === 'el-GR' ? 'verse-card-speaking' : ''} ${practiceLang === 'el-GR' ? 'verse-card-practicing' : ''}`}>
                                    <div className="verse-card-topbar">
                                        <h2>Greek</h2>
                                        <div className="practice-actions">
                                            <button
                                                className={`practice-btn ${practiceLang === 'el-GR' ? 'practice-btn-active' : ''}`}
                                                onClick={() => startPractice('el-GR', currentVerse.greek_text)}
                                                disabled={!sttAvailable || speakingLang !== null || (practiceLang !== null && practiceLang !== 'el-GR')}
                                                title="Practice pronunciation"
                                            >
                                                <span className="practice-emoji" aria-hidden="true">🎙️</span>
                                                {practiceLang === 'el-GR' ? 'STOP' : 'PRACTICE'}
                                            </button>
                                            <button
                                                className="practice-reset-btn"
                                                type="button"
                                                onClick={() => resetPracticeResults('el-GR')}
                                                disabled={!greekHasResults}
                                                title="Reset practice highlights"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                    <div className="verse-text greek-text" style={{ fontSize: `${1.2 * fontScale}rem` }}>
                                        {renderGreekWords(currentVerse.greek_text, greekHighlight, practiceResults['el-GR'])}
                                    </div>
                                    <div className="verse-card-footer">
                                        <div className="audio-controls">
                                            {speakingLang === 'el-GR' && (
                                                <div className="audio-side audio-side-left">
                                                    <label className="continue-toggle">
                                                        <input
                                                            type="checkbox"
                                                            checked={isAutoContinue}
                                                            onChange={(e) => setIsAutoContinue(e.target.checked)}
                                                        />
                                                        <span>Auto-next</span>
                                                    </label>
                                                    <button
                                                        className="control-btn"
                                                        onClick={goToPreviousWord}
                                                        disabled={activeWordIndex <= 0}
                                                        title="Previous word"
                                                    >
                                                        ⏮
                                                    </button>
                                                    <button
                                                        className="control-btn play-pause-btn"
                                                        onClick={togglePause}
                                                        title={isPaused ? 'Resume' : 'Pause'}
                                                    >
                                                        {isPaused ? '▶' : '⏸'}
                                                    </button>
                                                    <button
                                                        className="control-btn"
                                                        onClick={goToNextWord}
                                                        disabled={activeWordIndex >= spokenWordsRef.current.length - 1}
                                                        title="Next word"
                                                    >
                                                        ⏭
                                                    </button>
                                                </div>
                                            )}
                                            <button
                                                className={`speak-btn ${speakingLang === 'el-GR' ? 'speaking' : ''}`}
                                                onClick={() => speak(currentVerse.greek_text, 'el-GR', currentVerse.Text)}
                                                disabled={practiceLang !== null || (speakingLang !== null && speakingLang !== 'el-GR')}
                                                title="Listen in Greek"
                                            >
                                                <span className="speak-icon">
                                                    {speakingLang === 'el-GR' ? '⏹' : '🔊'}
                                                </span>
                                                <span className="speak-label">
                                                    {speakingLang === 'el-GR' ? 'Stop' : 'Listen'}
                                                </span>
                                            </button>
                                            <div className="audio-side audio-side-right">
                                                <span className="inline-speed-label">Speed</span>
                                                {[0.5, 1, 1.5].map((rate) => (
                                                    <button
                                                        key={rate}
                                                        className={`speed-btn ${speechRate === rate ? 'speed-btn-active' : ''}`}
                                                        onClick={() => setSpeechRate(rate)}
                                                        disabled={speakingLang !== null}
                                                    >
                                                        {rate}×
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="navigation">
                                <button
                                    onClick={goToPrevious}
                                    disabled={currentIndex === 0}
                                >
                                    ← Previous
                                </button>
                                <span className="verse-counter">
                                    {currentVerse.verse}
                                </span>
                                <button
                                    onClick={goToNext}
                                    disabled={currentIndex === data.length - 1}
                                >
                                    Next →
                                </button>
                            </div>
                        </>
                    ) : (
                        <p>Loading...</p>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Welcome
