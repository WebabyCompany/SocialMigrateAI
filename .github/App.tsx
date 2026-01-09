import React, { useState, useEffect, useRef } from 'react';
import { AppStep, Post, UserProfile, FacebookLoginStatus, FacebookPage, MigrationMode, Language } from './types';
import { Button } from './components/Button';
import { PostCard } from './components/PostCard';
import { MOCK_POSTS, MOCK_USER_NEW, MOCK_USER_OLD, MOCK_MANAGED_PAGES } from './services/mockData';
import { filterPostsWithGemini } from './services/geminiService';
import { fetchFacebookPosts, fetchFacebookProfile, fetchManagedPages, publishPostToPage } from './services/facebookService';
import { getTranslation } from './translations';

// Type definitions for Migration Log
type MigrationStatus = 'pending' | 'migrating' | 'success' | 'error';
interface MigrationLogItem {
  postId: string;
  contentPreview: string;
  status: MigrationStatus;
  error?: string;
}

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [migrationMode, setMigrationMode] = useState<MigrationMode>('PROFILE_TO_PAGE');
  const [lang, setLang] = useState<Language>('en');

  const t = getTranslation(lang);

  // --- ENVIRONMENT VARIABLES ---
  const appIdConsumer = process.env.FACEBOOK_APP_ID_CONSUMER || '';
  const appIdBusiness = process.env.FACEBOOK_APP_ID_BUSINESS || '';
  
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [currentAppId, setCurrentAppId] = useState<string>('');
  
  const [accessToken, setAccessToken] = useState('');
  const [destinationAccessToken, setDestinationAccessToken] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [oldConnected, setOldConnected] = useState(false);
  const [newConnected, setNewConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [managedPages, setManagedPages] = useState<FacebookPage[]>([]);
  const [showPageSelector, setShowPageSelector] = useState(false);
  const [pageSelectorType, setPageSelectorType] = useState<'source' | 'destination'>('destination');

  const [currentUser, setCurrentUser] = useState<UserProfile>({...MOCK_USER_OLD, id: 'mock_old'});
  const [destinationUser, setDestinationUser] = useState<UserProfile>({...MOCK_USER_NEW, id: 'mock_new'});
  const [sourcePosts, setSourcePosts] = useState<Post[]>(MOCK_POSTS);
  
  const [filterText, setFilterText] = useState('');
  const [dateRange, setDateRange] = useState<{start: string, end: string}>({ start: '', end: '' });
  const [isFiltering, setIsFiltering] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  
  const [editablePosts, setEditablePosts] = useState<Post[]>([]);
  const [migrationLog, setMigrationLog] = useState<MigrationLogItem[]>([]);

  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const defaultId = appIdConsumer || appIdBusiness;
    if (defaultId && !isSdkLoaded) initSdk(defaultId);
  }, [appIdConsumer, appIdBusiness, isSdkLoaded]);

  const initSdk = (appId: string) => {
    if (!appId) return;
    if ((window as any).FB) {
        (window as any).FB.init({ appId, cookie: true, xfbml: true, version: 'v19.0' });
        setCurrentAppId(appId);
        setIsSdkLoaded(true);
    } else {
        (window as any).fbAsyncInit = () => {
            (window as any).FB.init({ appId, cookie: true, xfbml: true, version: 'v19.0' });
            setCurrentAppId(appId);
            setIsSdkLoaded(true);
        };
        (function(d, s, id){
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) return;
            js = d.createElement(s) as HTMLScriptElement; js.id = id;
            js.src = "https://connect.facebook.net/en_US/sdk.js";
            fjs.parentNode?.insertBefore(js, fjs);
        }(document, 'script', 'facebook-jssdk'));
    }
  };

  const handleConnectOldAccount = () => {
    setIsLoadingAuth(true);
    setTimeout(() => {
      if (migrationMode === 'PAGE_TO_PAGE') {
        setManagedPages(MOCK_MANAGED_PAGES);
        setPageSelectorType('source');
        setShowPageSelector(true);
      } else {
        setOldConnected(true);
        setCurrentUser({...MOCK_USER_OLD, id: 'demo_source'});
        setSourcePosts(MOCK_POSTS);
      }
      setIsLoadingAuth(false);
    }, 800);
  };

  const handleConnectNewAccount = () => {
    setIsLoadingAuth(true);
    setTimeout(() => {
      setManagedPages(MOCK_MANAGED_PAGES);
      setPageSelectorType('destination');
      setShowPageSelector(true);
      setIsLoadingAuth(false);
    }, 800);
  };

  const prepareConnection = (target: 'source' | 'destination') => {
    setError(null);
    let requiredId = target === 'source' ? (migrationMode === 'PROFILE_TO_PAGE' ? appIdConsumer : appIdBusiness) : appIdBusiness;
    if (!requiredId) {
      setError(`Brak ID Aplikacji dla ${target}. Sprawdź plik .env (Consumer dla Profilu, Business dla Stron).`);
      return;
    }
    if (currentAppId !== requiredId) initSdk(requiredId);
    setTimeout(() => handleFacebookLogin(target), 200);
  };

  const handleFacebookLogin = (target: 'source' | 'destination') => {
    if (!isSdkLoaded) return;
    setIsLoadingAuth(true);
    let scope = target === 'source' ? (migrationMode === 'PROFILE_TO_PAGE' ? 'public_profile,user_posts' : 'public_profile,pages_show_list,pages_read_engagement') : 'public_profile,pages_manage_posts,publish_pages,pages_show_list';
    
    window.FB.login((response: FacebookLoginStatus) => {
        if (response.status === 'connected' && response.authResponse) {
            fetchRealData(response.authResponse.accessToken, target);
        } else {
            setIsLoadingAuth(false);
            setError(lang === 'pl' ? "Logowanie przerwane." : "Login failed.");
        }
    }, { scope, auth_type: 'reauthenticate' });
  };

  const fetchRealData = async (token: string, target: 'source' | 'destination') => {
    setIsLoadingAuth(true);
    try {
      if (target === 'source') {
        if (migrationMode === 'PROFILE_TO_PAGE') {
            const profile = await fetchFacebookProfile(token);
            const posts = await fetchFacebookPosts(token, 'me/feed');
            setCurrentUser(profile);
            setSourcePosts(posts);
            setAccessToken(token);
            setOldConnected(true);
        } else {
            const pages = await fetchManagedPages(token);
            setManagedPages(pages);
            setPageSelectorType('source');
            setShowPageSelector(true);
        }
      } else {
        const pages = await fetchManagedPages(token);
        setManagedPages(pages);
        setPageSelectorType('destination');
        setShowPageSelector(true);
      }
    } catch (err: any) {
      setError(err.message);
    }
    setIsLoadingAuth(false);
  };

  const handleSelectPage = async (page: FacebookPage) => {
    if (mode === 'demo') {
        const profile = { id: page.id, name: page.name, avatar: page.picture?.data?.url || '', handle: '@' + page.name };
        if (pageSelectorType === 'source') { setCurrentUser(profile); setSourcePosts(MOCK_POSTS); setOldConnected(true); }
        else { setDestinationUser(profile); setNewConnected(true); }
    } else {
        if (pageSelectorType === 'source') {
            const posts = await fetchFacebookPosts(page.access_token, `${page.id}/feed`);
            setSourcePosts(posts);
            setCurrentUser({ id: page.id, name: page.name, avatar: page.picture?.data?.url || '', handle: '@' + page.name });
            setOldConnected(true);
        } else {
            setDestinationUser({ id: page.id, name: page.name, avatar: page.picture?.data?.url || '', handle: '@' + page.name });
            setDestinationAccessToken(page.access_token);
            setNewConnected(true);
        }
    }
    setShowPageSelector(false);
  };

  const handleAnalyze = async () => {
    if (!filterText.trim()) return;
    setIsFiltering(true);
    let candidatePosts = sourcePosts;
    if (dateRange.start) candidatePosts = candidatePosts.filter(p => p.date >= dateRange.start);
    if (dateRange.end) candidatePosts = candidatePosts.filter(p => p.date <= dateRange.end);
    const matchingIds = await filterPostsWithGemini(candidatePosts, filterText);
    const relevant = candidatePosts.filter(p => matchingIds.includes(p.id));
    setFilteredPosts(relevant);
    setSelectedPostIds(new Set(relevant.map(p => p.id)));
    setIsFiltering(false);
    setStep(AppStep.REVIEW);
  };

  const handleStartMigration = async () => {
    setStep(AppStep.MIGRATING);
    setIsMigrating(true);
    setMigrationProgress(0);
    setMigrationLog(editablePosts.map(p => ({ postId: p.id, contentPreview: p.content.substring(0, 50) + '...', status: 'pending' })));

    let completed = 0;
    for (const post of editablePosts) {
      setMigrationLog(prev => prev.map(item => item.postId === post.id ? { ...item, status: 'migrating' } : item));
      
      try {
        if (mode === 'demo') {
            await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
            await publishPostToPage(destinationUser.id, destinationAccessToken, post.content, post.imageUrl);
        }
        setMigrationLog(prev => prev.map(item => item.postId === post.id ? { ...item, status: 'success' } : item));
      } catch (err: any) {
        setMigrationLog(prev => prev.map(item => item.postId === post.id ? { ...item, status: 'error', error: err.message } : item));
      }
      
      completed++;
      setMigrationProgress((completed / editablePosts.length) * 100);
      if (logContainerRef.current) logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
    setIsMigrating(false);
    setStep(AppStep.COMPLETED);
  };

  const renderLogin = () => (
    <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-xl shadow-lg border relative">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-facebook-blue">{t.appTitle}</h1>
        <div className="flex gap-2">
            <button onClick={() => setMode('demo')} className={`text-[10px] px-2 py-1 rounded transition-colors ${mode === 'demo' ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-400 hover:bg-gray-100'}`}>{t.demo}</button>
            <button onClick={() => setMode('live')} className={`text-[10px] px-2 py-1 rounded transition-colors ${mode === 'live' ? 'bg-red-100 text-red-600 font-bold' : 'text-gray-400 hover:bg-gray-100'}`}>{t.live}</button>
        </div>
      </div>

      {/* Language Switcher */}
      <div className="flex gap-3 mb-6 justify-center">
        {(['en', 'pl', 'de'] as Language[]).map(l => (
          <button 
            key={l} 
            onClick={() => setLang(l)} 
            className={`text-xs font-bold uppercase ${lang === l ? 'text-facebook-blue' : 'text-gray-300'}`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mb-6 p-1 bg-gray-100 rounded-lg flex">
        <button 
          onClick={() => { setMigrationMode('PROFILE_TO_PAGE'); setOldConnected(false); }}
          className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all ${migrationMode === 'PROFILE_TO_PAGE' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
        >
          {t.profileToPage}
        </button>
        <button 
          onClick={() => { setMigrationMode('PAGE_TO_PAGE'); setOldConnected(false); }}
          className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-all ${migrationMode === 'PAGE_TO_PAGE' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
        >
          {t.pageToPage}
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded border border-red-100">{error}</div>}
      
      <div className="space-y-4">
          <div className="p-4 border rounded-xl flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 overflow-hidden">
                  {oldConnected ? <img src={currentUser.avatar} className="w-full h-full object-cover" /> : <i className="fas fa-sign-out-alt"></i>}
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t.source}</div>
                  <div className="font-bold text-sm truncate max-w-[120px]">{oldConnected ? currentUser.name : t.notConnected}</div>
                </div>
              </div>
              {!oldConnected ? <Button onClick={() => mode === 'demo' ? handleConnectOldAccount() : prepareConnection('source')} loadingText={t.processing}>{t.connect}</Button> : <i className="fas fa-check-circle text-green-500"></i>}
          </div>

          <div className="flex justify-center -my-2 relative z-10">
            <div className="bg-white p-1 rounded-full border shadow-sm">
              <i className="fas fa-arrow-down text-gray-400 text-xs"></i>
            </div>
          </div>

          <div className="p-4 border rounded-xl flex justify-between items-center bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 overflow-hidden">
                  {newConnected ? <img src={destinationUser.avatar} className="w-full h-full object-cover" /> : <i className="fas fa-sign-in-alt"></i>}
                </div>
                <div>
                  <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{t.destination}</div>
                  <div className="font-bold text-sm truncate max-w-[120px]">{newConnected ? destinationUser.name : t.notConnected}</div>
                </div>
              </div>
              {!newConnected ? <Button disabled={!oldConnected && mode === 'live'} onClick={() => mode === 'demo' ? handleConnectNewAccount() : prepareConnection('destination')} loadingText={t.processing}>{t.connect}</Button> : <i className="fas fa-check-circle text-green-500"></i>}
          </div>
      </div>

      <Button fullWidth disabled={!oldConnected || !newConnected} className="mt-8 py-3 shadow-lg" onClick={() => setStep(AppStep.FILTER_INPUT)} loadingText={t.processing}>{t.startFiltering}</Button>

      {showPageSelector && (
          <div className="absolute inset-0 bg-white p-6 z-50 rounded-xl overflow-y-auto">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <i className="fas fa-flag text-blue-600"></i> {t.selectPage}
              </h3>
              <div className="space-y-2">
                {managedPages.map(page => (
                    <button key={page.id} onClick={() => handleSelectPage(page)} className="w-full text-left p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-all flex items-center gap-3 group">
                        <img src={page.picture?.data?.url} className="w-10 h-10 rounded-full border shadow-sm" /> 
                        <span className="font-medium text-sm group-hover:text-blue-700">{page.name}</span>
                    </button>
                ))}
              </div>
              <Button variant="ghost" fullWidth className="mt-4" onClick={() => setShowPageSelector(false)} loadingText={t.processing}>{t.cancel}</Button>
          </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-facebook-bg p-4 font-sans">
      {step === AppStep.LOGIN && renderLogin()}
      {step === AppStep.FILTER_INPUT && (
          <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-xl shadow-lg border">
              <h2 className="text-xl font-bold mb-4">{t.filterHeading}</h2>
              <p className="text-xs text-gray-500 mb-6">{t.filterSubheading}</p>
              <textarea 
                className="w-full p-4 rounded-xl border mb-4 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[100px]" 
                placeholder={t.filterPlaceholder}
                value={filterText} 
                onChange={e => setFilterText(e.target.value)} 
              />
              <Button fullWidth onClick={handleAnalyze} isLoading={isFiltering} icon={<i className="fas fa-magic"></i>} loadingText={t.processing}>{t.analyzePosts}</Button>
              <Button variant="ghost" fullWidth className="mt-2" onClick={() => setStep(AppStep.LOGIN)} loadingText={t.processing}>{t.back}</Button>
          </div>
      )}
      {step === AppStep.REVIEW && (
          <div className="max-w-4xl mx-auto py-8">
              <div className="flex justify-between items-center mb-6 px-4 md:px-0">
                <h2 className="text-2xl font-bold">{t.reviewHeading}</h2>
                <div className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  {t.selected}: {selectedPostIds.size}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 md:px-0">
                  {filteredPosts.map(p => <PostCard key={p.id} post={p} isSelected={selectedPostIds.has(p.id)} onToggle={id => {
                      const n = new Set(selectedPostIds);
                      n.has(id) ? n.delete(id) : n.add(id);
                      setSelectedPostIds(n);
                  }} />)}
              </div>
              <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xs px-4">
                <Button fullWidth className="shadow-2xl" onClick={() => { setEditablePosts(filteredPosts.filter(p => selectedPostIds.has(p.id))); setStep(AppStep.EDIT_PREVIEW); }} loadingText={t.processing}>
                  {t.next} ({selectedPostIds.size})
                </Button>
              </div>
          </div>
      )}
      {step === AppStep.EDIT_PREVIEW && (
          <div className="max-w-2xl mx-auto space-y-4 py-8 px-4 md:px-0">
              <h2 className="text-2xl font-bold mb-4">{t.editHeading}</h2>
              {editablePosts.map(p => (
                <div key={p.id} className="p-4 bg-white rounded-xl shadow-sm border overflow-hidden">
                  <div className="text-[10px] text-gray-400 font-bold mb-2 uppercase tracking-tighter">{t.originalDate}: {p.date}</div>
                  <textarea 
                    className="w-full text-sm border-none focus:ring-0 p-0 resize-none min-h-[80px]" 
                    rows={4} 
                    defaultValue={p.content} 
                    onChange={e => p.content = e.target.value} 
                  />
                  {p.imageUrl && <div className="mt-2 rounded-lg overflow-hidden h-40 bg-gray-100"><img src={p.imageUrl} className="w-full h-full object-cover" /></div>}
                </div>
              ))}
              <div className="pt-6">
                <Button fullWidth onClick={handleStartMigration} icon={<i className="fas fa-rocket"></i>} loadingText={t.processing}>{t.publishButton}</Button>
                <Button variant="ghost" fullWidth className="mt-2" onClick={() => setStep(AppStep.REVIEW)} loadingText={t.processing}>{t.backToReview}</Button>
              </div>
          </div>
      )}
      {step === AppStep.MIGRATING && (
          <div className="max-w-md mx-auto text-center mt-20 p-8 bg-white rounded-2xl shadow-xl border">
              <div className="mb-6">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-500 text-3xl animate-bounce">
                  <i className="fas fa-cloud-upload-alt"></i>
                </div>
              </div>
              <h2 className="text-xl font-bold mb-4">{t.migrating} {Math.round(migrationProgress)}%</h2>
              <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden mb-6">
                <div className="h-full bg-facebook-blue transition-all duration-500 shadow-[0_0_10px_rgba(24,119,242,0.5)]" style={{width: `${migrationProgress}%`}}></div>
              </div>
              <div ref={logContainerRef} className="text-left bg-gray-50 p-4 rounded-xl border max-h-60 overflow-y-auto space-y-2 text-[11px] font-mono">
                  {migrationLog.map((l, i) => (
                    <div key={i} className="flex justify-between items-center border-b border-gray-100 pb-1">
                      <span className="truncate max-w-[200px] text-gray-600">{l.contentPreview}</span>
                      <span className={`font-bold ${l.status === 'success' ? 'text-green-500' : l.status === 'error' ? 'text-red-500' : 'text-blue-500'}`}>
                        {l.status === 'success' ? t.done : l.status === 'error' ? t.error : t.sending}
                      </span>
                    </div>
                  ))}
              </div>
          </div>
      )}
      {step === AppStep.COMPLETED && (
          <div className="max-w-md mx-auto text-center mt-20 p-10 bg-white rounded-2xl shadow-2xl border">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-500 text-4xl mb-6">
                <i className="fas fa-check"></i>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{t.success}</h2>
              <p className="text-gray-500 mb-8">{t.successSub}</p>
              <Button fullWidth onClick={() => {
                setOldConnected(false);
                setNewConnected(false);
                setStep(AppStep.LOGIN);
              }} loadingText={t.processing}>{t.startOver}</Button>
          </div>
      )}
    </div>
  );
};

export default App;