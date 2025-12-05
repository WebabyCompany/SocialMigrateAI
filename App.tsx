import React, { useState, useEffect, useRef } from 'react';
import { AppStep, Post, UserProfile, FacebookLoginStatus } from './types';
import { Button } from './components/Button';
import { PostCard } from './components/PostCard';
import { MOCK_POSTS, MOCK_USER_NEW, MOCK_USER_OLD } from './services/mockData';
import { filterPostsWithGemini } from './services/geminiService';
import { fetchFacebookPosts, fetchFacebookProfile } from './services/facebookService';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  
  // Connection State
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [facebookAppId, setFacebookAppId] = useState('');
  const [isSdkLoaded, setIsSdkLoaded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Auth Method State
  const isSecure = typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const [authMethod, setAuthMethod] = useState<'auto' | 'manual'>('auto'); 
  const [connectingTarget, setConnectingTarget] = useState<'source' | 'destination'>('source');
  
  const [accessToken, setAccessToken] = useState('');
  const [destinationAccessToken, setDestinationAccessToken] = useState('');
  const [manualTokenInput, setManualTokenInput] = useState('');
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [oldConnected, setOldConnected] = useState(false);
  const [newConnected, setNewConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [httpsWarningDismissed, setHttpsWarningDismissed] = useState(false);

  // Data State
  const [currentUser, setCurrentUser] = useState<UserProfile>(MOCK_USER_OLD);
  const [destinationUser, setDestinationUser] = useState<UserProfile>(MOCK_USER_NEW);
  const [sourcePosts, setSourcePosts] = useState<Post[]>(MOCK_POSTS);
  
  // App Logic State
  const [filterText, setFilterText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState(0);
  
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());

  // Refs for Speech Recognition
  const recognitionRef = useRef<any>(null);

  // Load App ID from Local Storage on Mount
  useEffect(() => {
    const storedAppId = localStorage.getItem('fb_app_id');
    if (storedAppId) {
      setFacebookAppId(storedAppId);
    }
  }, []);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setFilterText(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech error", event);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  // Initialize Facebook SDK when App ID is provided
  useEffect(() => {
    const shouldLoadSdk = facebookAppId && !isSdkLoaded && authMethod === 'auto' && (isSecure || httpsWarningDismissed);
    
    if (shouldLoadSdk) {
      // Load SDK asynchronously
      (window as any).fbAsyncInit = function() {
        window.FB.init({
          appId      : facebookAppId,
          cookie     : true,
          xfbml      : true,
          version    : 'v19.0'
        });
        setIsSdkLoaded(true);
        console.log("Facebook SDK Initialized");
      };

      // Inject script
      (function(d, s, id){
         var js, fjs = d.getElementsByTagName(s)[0];
         if (d.getElementById(id)) {return;}
         js = d.createElement(s) as HTMLScriptElement; js.id = id;
         js.src = "https://connect.facebook.net/en_US/sdk.js";
         fjs.parentNode?.insertBefore(js, fjs);
       }(document, 'script', 'facebook-jssdk'));
    }
  }, [facebookAppId, isSdkLoaded, authMethod, isSecure, httpsWarningDismissed]);

  // Handlers
  const handleSaveSettings = (newAppId: string) => {
    setFacebookAppId(newAppId);
    localStorage.setItem('fb_app_id', newAppId);
    setIsSettingsOpen(false);
    // Reload page to force SDK re-init if ID changed
    if (isSdkLoaded) {
      window.location.reload();
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  const handleConnectOldAccount = () => {
    setCurrentUser(MOCK_USER_OLD);
    setSourcePosts(MOCK_POSTS);
    setOldConnected(true);
    setError(null);
  };

  const handleConnectNewAccount = () => {
    setDestinationUser(MOCK_USER_NEW);
    setNewConnected(true);
    setError(null);
  }

  const handleSwitchToHttps = () => {
    if (typeof window !== 'undefined') {
      window.location.href = window.location.href.replace(/^http:/, 'https:');
    }
  };

  const handleFacebookLogin = (targetOverride?: 'source' | 'destination') => {
    // Check security, allowing bypass if user dismissed warning
    if (!isSecure && !httpsWarningDismissed) {
      setError("Facebook Login requires HTTPS. Please switch to HTTPS first.");
      return;
    }

    if (!facebookAppId) {
      setError("System Configuration Error: Facebook App ID is missing. Please contact the administrator.");
      // If we are in live mode and no ID, open settings for convenience since this is likely the admin testing
      setIsSettingsOpen(true);
      return;
    }

    if (!isSdkLoaded) {
      setError("Connecting to Facebook SDK... Please wait a moment and try again.");
      return;
    }

    const target = targetOverride || connectingTarget;
    setIsLoadingAuth(true);
    setError(null);

    // Determine scopes based on target
    // Source: Read posts
    // Destination: Write permissions (Pages API is the standard for automated posting now)
    const scope = target === 'source' 
      ? 'public_profile,user_posts' 
      : 'public_profile,pages_manage_posts,pages_read_engagement,publish_pages';

    try {
      // Use reauthenticate to force user to pick/switch accounts if needed
      window.FB.login((response: FacebookLoginStatus) => {
        if (response.status === 'connected' && response.authResponse) {
          const token = response.authResponse.accessToken;
          fetchRealData(token, target);
        } else {
          setIsLoadingAuth(false);
          // If response.status is unknown, it might be due to insecure context
          if (response.status === 'unknown' && !isSecure) {
             setError("Login failed. Facebook may be blocking the popup on HTTP. Try switching to HTTPS.");
          } else {
             setError("Login cancelled or failed.");
          }
        }
      }, { 
        scope: scope,
        auth_type: 'reauthenticate' // Forces login popup to switch accounts
      });
    } catch (e) {
      console.error(e);
      setError("Failed to trigger Facebook Login. Popups might be blocked.");
      setIsLoadingAuth(false);
    }
  };

  const fetchRealData = async (token: string, target: 'source' | 'destination') => {
    if (!token) {
        setError("Invalid access token.");
        return;
    }
    setIsLoadingAuth(true);
    setError(null);

    try {
      // Always fetch profile
      const profile = await fetchFacebookProfile(token);
      
      if (target === 'source') {
        const posts = await fetchFacebookPosts(token);
        if (posts.length === 0) {
           setError("Connected, but found 0 posts. Ensure 'user_posts' permission is granted.");
           // We still connect even if 0 posts, just warn
        }
        setCurrentUser(profile);
        setSourcePosts(posts);
        setOldConnected(true);
        setAccessToken(token);
      } else {
        // Destination - we just need the profile and the token for future writing
        setDestinationUser(profile);
        setNewConnected(true);
        setDestinationAccessToken(token);
      }

      // Hide manual input after success
      setManualTokenInput('');
      
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch data. Check your token permissions.");
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleAnalyze = async () => {
    if (!filterText.trim()) return;
    setIsFiltering(true);
    
    const matchingIds = await filterPostsWithGemini(sourcePosts, filterText);
    
    const relevant = sourcePosts.filter(p => matchingIds.includes(p.id));
    setFilteredPosts(relevant);
    
    setSelectedPostIds(new Set(relevant.map(p => p.id)));
    
    setIsFiltering(false);
    setStep(AppStep.REVIEW);
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedPostIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedPostIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedPostIds.size === filteredPosts.length) {
      setSelectedPostIds(new Set());
    } else {
      setSelectedPostIds(new Set(filteredPosts.map(p => p.id)));
    }
  };

  const handleStartMigration = () => {
    setStep(AppStep.MIGRATING);
    setIsMigrating(true);
    setMigrationProgress(0);

    const total = selectedPostIds.size;
    let completed = 0;
    
    const interval = setInterval(() => {
      completed += 1;
      const pct = Math.min((completed / total) * 100, 100);
      setMigrationProgress(pct);

      if (completed >= total) {
        clearInterval(interval);
        setTimeout(() => {
          setIsMigrating(false);
          setStep(AppStep.COMPLETED);
        }, 800);
      }
    }, 800); 
  };

  const resetApp = () => {
    setStep(AppStep.FILTER_INPUT);
    setFilterText('');
    setFilteredPosts([]);
    setSelectedPostIds(new Set());
    setMigrationProgress(0);
  };

  // --- RENDER COMPONENTS ---

  const renderAdminModal = () => {
    if (!isSettingsOpen) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-800">Administrator Settings</h3>
            <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-600">
              <i className="fas fa-times"></i>
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4 bg-yellow-50 p-3 rounded border border-yellow-100">
            <i className="fas fa-lock mr-2 text-yellow-500"></i>
            This panel is for administrators only. Configure the Facebook App ID here so standard users can log in.
          </p>

          <div className="mb-4">
            <label className="block text-xs font-bold text-facebook-blue mb-1">Facebook App ID</label>
            <input 
              type="text" 
              defaultValue={facebookAppId}
              placeholder="e.g., 1234567890"
              className="w-full p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-facebook-blue outline-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveSettings((e.target as HTMLInputElement).value);
              }}
              onBlur={(e) => handleSaveSettings(e.target.value)}
            />
          </div>
          
          <div className="flex justify-end">
            <Button onClick={() => setIsSettingsOpen(false)}>Close & Save</Button>
          </div>
        </div>
      </div>
    );
  };

  const renderLogin = () => {
    // Show auth panel if in Live mode AND (Current target is not connected)
    const showAuthPanel = mode === 'live' && (
      (connectingTarget === 'source' && !oldConnected) || 
      (connectingTarget === 'destination' && !newConnected)
    );

    return (
      <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-xl shadow-lg border border-gray-100 relative">
        {/* Admin Gear Icon */}
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors"
          title="Admin Settings"
        >
          <i className="fas fa-cog"></i>
        </button>

        <div className="flex justify-between items-center mb-6 pr-8">
          <h1 className="text-2xl font-bold text-facebook-blue">SocialMigrate AI</h1>
        </div>

        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button 
              onClick={() => { setMode('demo'); setOldConnected(false); setNewConnected(false); setError(null); }}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'demo' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Demo Mode
            </button>
            <button 
              onClick={() => { setMode('live'); setOldConnected(false); setNewConnected(false); setError(null); }}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${mode === 'live' ? 'bg-white shadow text-facebook-blue' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Live Mode
            </button>
        </div>
        
        <p className="text-center text-gray-500 mb-6 text-sm">
          {mode === 'demo' 
            ? "Try the app with sample data. No login required." 
            : "Connect your real Facebook accounts to migrate posts."}
        </p>

        {/* Live Mode Configuration */}
        {showAuthPanel && (
           <div className="mb-6 animate-fade-in">
             <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
               {connectingTarget === 'source' ? '1. Connect Old Account (Source)' : '2. Connect New Account (Destination)'}
             </div>
             
             {/* Tab Switcher - Only needed for Manual override fallback */}
             {/* If not secure, we show manual fallback or HTTPS switch. If secure, we show login. */}

             {/* Insecure Connection Blocker for Auto Mode */}
             {!isSecure && authMethod === 'auto' ? (
               <div className="bg-red-50 border border-red-100 p-4 rounded-lg text-center">
                 <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                   <i className="fas fa-lock text-red-500 text-xl"></i>
                 </div>
                 <h3 className="text-red-800 font-bold text-sm mb-1">Security Update Required</h3>
                 <p className="text-xs text-red-600 mb-4">
                   Facebook Login strictly requires a secure HTTPS connection.
                 </p>
                 <Button 
                   fullWidth
                   onClick={handleSwitchToHttps}
                   variant="danger"
                   icon={<i className="fas fa-sync"></i>}
                 >
                   Switch to HTTPS
                 </Button>
                 
                 <div className="mt-4 border-t border-red-100 pt-3">
                   <button 
                      onClick={() => setAuthMethod('manual')}
                      className="text-xs text-gray-500 underline"
                   >
                     Use Manual Token (Advanced)
                   </button>
                 </div>
                 
                 {!httpsWarningDismissed && (
                    <button 
                        onClick={() => setHttpsWarningDismissed(true)}
                        className="text-[10px] text-gray-400 mt-2 hover:text-gray-600 block w-full"
                    >
                        Dismiss warning (testing only)
                    </button>
                 )}
               </div>
             ) : (
               <>
                 {/* Automatic Flow (Secure or Dismissed) */}
                 {authMethod === 'auto' && (
                   <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                     <Button 
                       fullWidth 
                       onClick={() => handleFacebookLogin()}
                       isLoading={isLoadingAuth}
                       className="py-3"
                       icon={<i className="fab fa-facebook-f"></i>}
                     >
                       {connectingTarget === 'source' ? 'Log In to Old Account' : 'Log In to New Account'}
                     </Button>
                     <p className="text-[10px] text-gray-500 mt-3 text-center">
                       {connectingTarget === 'destination' 
                          ? 'We will ask for permission to create posts on your behalf.' 
                          : 'We will ask for permission to read your timeline posts.'}
                     </p>
                     
                     <div className="mt-3 text-center">
                       <button 
                          onClick={() => setAuthMethod('manual')}
                          className="text-[10px] text-gray-400 hover:text-gray-600"
                       >
                         Issues connecting? Use Manual Token
                       </button>
                     </div>
                   </div>
                 )}
               </>
             )}
             
             {/* Allow bypass if warning dismissed even on insecure */}
             {!isSecure && httpsWarningDismissed && authMethod === 'auto' && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mt-2">
                     <Button 
                       fullWidth 
                       onClick={() => handleFacebookLogin()}
                       isLoading={isLoadingAuth}
                       icon={<i className="fab fa-facebook-f"></i>}
                     >
                       {connectingTarget === 'source' ? 'Log In to Old Account' : 'Log In to New Account'}
                     </Button>
                  </div>
             )}

             {/* Manual Token Flow */}
             {authMethod === 'manual' && (
               <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-gray-600">Manual Connection</span>
                    <button onClick={() => setAuthMethod('auto')} className="text-xs text-facebook-blue">Cancel</button>
                  </div>
                  <ol className="list-decimal list-inside text-xs text-gray-600 mb-3 space-y-1">
                    <li>Open <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener noreferrer" className="text-facebook-blue underline hover:text-blue-800">Graph API Explorer</a>.</li>
                    <li>
                        In "Permissions", add: 
                        <span className="font-mono bg-gray-200 px-1 rounded ml-1">
                            {connectingTarget === 'source' ? 'user_posts' : 'publish_pages'}
                        </span>
                    </li>
                    <li>Click <strong>Generate Access Token</strong>.</li>
                  </ol>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={manualTokenInput}
                      onChange={(e) => setManualTokenInput(e.target.value)}
                      placeholder="Paste Access Token here..."
                      className="flex-1 p-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900"
                    />
                    <Button 
                      onClick={() => fetchRealData(manualTokenInput, connectingTarget)}
                      disabled={!manualTokenInput || isLoadingAuth}
                      isLoading={isLoadingAuth}
                      className="whitespace-nowrap"
                    >
                      Connect
                    </Button>
                  </div>
               </div>
             )}
           </div>
        )}

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 animate-fade-in">
            <i className="fas fa-exclamation-circle text-red-500 mt-0.5"></i>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Old Account Status */}
          <div className={`p-4 border rounded-lg flex flex-col transition-colors ${oldConnected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {oldConnected ? (
                  <img src={currentUser.avatar} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200" />
                ) : (
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200">
                    <i className={`fab fa-facebook text-2xl text-facebook-blue`}></i>
                  </div>
                )}
                <div className="overflow-hidden">
                  <div className="font-medium text-gray-900 truncate max-w-[150px]">{oldConnected ? currentUser.name : 'Old Account'}</div>
                  <div className="text-xs text-gray-500">{oldConnected ? `${sourcePosts.length} posts loaded` : 'Source'}</div>
                </div>
              </div>
              
              {oldConnected ? (
                 <Button variant="secondary" onClick={() => { setOldConnected(false); setAccessToken(''); }} className="text-xs h-8">
                   Disconnect
                 </Button>
              ) : (
                 <Button 
                    onClick={() => {
                        if (mode === 'demo') handleConnectOldAccount();
                        else {
                            setConnectingTarget('source');
                            setError(null);
                            // Try auto-connect logic
                            if (facebookAppId && isSdkLoaded) {
                                handleFacebookLogin('source');
                            }
                        }
                    }} 
                    className="text-xs h-9"
                    disabled={mode === 'live' && connectingTarget === 'destination' && !newConnected} // Disable if currently focusing on new
                 >
                   Connect
                 </Button>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <i className="fas fa-arrow-down text-gray-300"></i>
          </div>

          {/* New Account */}
          <div className={`p-4 border rounded-lg flex flex-col transition-colors ${newConnected ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {newConnected ? (
                    <img src={destinationUser.avatar} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200" />
                    ) : (
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200">
                        <i className={`fab fa-facebook text-2xl ${newConnected ? 'text-facebook-blue' : 'text-gray-400'}`}></i>
                    </div>
                    )}
                    <div>
                    <div className="font-medium text-gray-900">{newConnected ? destinationUser.name : 'New Account'}</div>
                    <div className="text-xs text-gray-500">Destination</div>
                    </div>
                </div>
                {newConnected ? (
                    <Button variant="secondary" onClick={() => { setNewConnected(false); setDestinationAccessToken(''); }} className="text-xs h-8">
                        Disconnect
                    </Button>
                ) : (
                    <Button 
                        onClick={() => {
                             if (mode === 'demo') handleConnectNewAccount();
                             else {
                                 setConnectingTarget('destination');
                                 setError(null);
                                 // Try auto-connect logic
                                 if (facebookAppId && isSdkLoaded) {
                                     handleFacebookLogin('destination');
                                 }
                             }
                        }}
                        className="text-xs h-9"
                        disabled={!oldConnected && mode === 'live'} // Enforce order: Source first
                    >
                        Connect
                    </Button>
                )}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Button 
            fullWidth 
            disabled={!oldConnected || !newConnected}
            onClick={() => setStep(AppStep.FILTER_INPUT)}
          >
            Continue
          </Button>
        </div>
      </div>
    );
  };

  const renderFilterInput = () => (
    <div className="max-w-2xl mx-auto mt-16 px-4">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">What should we move?</h2>
        <p className="text-gray-600">
          AI Agent will scan <strong>{sourcePosts.length}</strong> posts from {currentUser.name}.
          <br/>Try "Concerts from 2023" or "Photos of my cat".
        </p>
      </div>

      <div className="relative bg-white p-2 rounded-2xl shadow-xl border border-gray-200 flex items-center gap-2">
        <div className="pl-4 text-gray-400">
          <i className="fas fa-sparkles"></i>
        </div>
        <input 
          type="text" 
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Describe the posts to filter..."
          className="flex-1 p-4 outline-none text-lg text-gray-700 placeholder-gray-400 bg-transparent"
          onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
        />
        <button 
          onClick={handleMicClick}
          className={`p-4 rounded-xl transition-all duration-200 ${isListening ? 'bg-red-50 text-red-500 animate-pulse' : 'hover:bg-gray-100 text-gray-500'}`}
          title="Speak"
        >
          <i className={`fas fa-microphone ${isListening ? 'fa-beat' : ''}`}></i>
        </button>
      </div>

      <div className="mt-8 flex justify-center">
        <Button 
          onClick={handleAnalyze} 
          isLoading={isFiltering}
          disabled={!filterText || isFiltering}
          className="px-12 py-4 text-lg rounded-full shadow-lg shadow-blue-500/30"
        >
          Find Posts
        </Button>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="max-w-5xl mx-auto mt-8 px-4 mb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Found {filteredPosts.length} posts</h2>
          <p className="text-gray-500 text-sm">Topic: <span className="font-medium text-facebook-blue">"{filterText}"</span></p>
        </div>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={selectedPostIds.size === filteredPosts.length && filteredPosts.length > 0}
              onChange={handleSelectAll}
              className="rounded text-facebook-blue focus:ring-facebook-blue"
            />
            Select All
          </label>
          <Button 
            onClick={handleStartMigration}
            disabled={selectedPostIds.size === 0}
            icon={<i className="fas fa-rocket"></i>}
          >
            Migrate {selectedPostIds.size} Posts
          </Button>
        </div>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <div className="text-6xl mb-4">👻</div>
          <h3 className="text-xl font-medium text-gray-900">No posts found</h3>
          <p className="text-gray-500 mb-6">We couldn't find any posts matching your description.</p>
          <Button variant="secondary" onClick={() => setStep(AppStep.FILTER_INPUT)}>Try a different topic</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map(post => (
            <PostCard 
              key={post.id} 
              post={post} 
              isSelected={selectedPostIds.has(post.id)}
              onToggle={handleToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );

  const renderMigrating = () => (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 relative">
          <div className="w-24 h-24 bg-blue-50 rounded-full mx-auto flex items-center justify-center animate-pulse">
            <i className="fas fa-sync fa-spin text-4xl text-facebook-blue"></i>
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Migrating Posts...</h2>
        <p className="text-gray-500 mb-8">Moving memories to {destinationUser.name}</p>

        <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden mb-4">
          <div 
            className="bg-facebook-blue h-full transition-all duration-300 ease-out"
            style={{ width: `${migrationProgress}%` }}
          ></div>
        </div>
        <p className="text-sm text-gray-400 font-mono">{Math.round(migrationProgress)}% Complete</p>
      </div>
    </div>
  );

  const renderCompleted = () => (
    <div className="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl shadow-lg border border-gray-100 text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full mx-auto flex items-center justify-center mb-6">
        <i className="fas fa-check text-3xl text-green-600"></i>
      </div>
      
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Migration Complete!</h2>
      <p className="text-gray-600 mb-8">
        Processed <span className="font-bold">{selectedPostIds.size}</span> posts.
        {mode === 'live' && (
          <span className="block mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
            Note: Content has been prepared for migration. 
            Automated posting to personal profiles is restricted by Facebook API.
          </span>
        )}
      </p>

      <div className="space-y-3">
        <Button fullWidth onClick={resetApp}>Start New Migration</Button>
        <Button fullWidth variant="ghost" onClick={() => setStep(AppStep.LOGIN)}>Sign Out</Button>
      </div>
    </div>
  );

  // --- MAIN RENDER ---

  return (
    <div className="min-h-screen pb-10 bg-facebook-bg">
      {renderAdminModal()}
      
      {/* Header */}
      {step !== AppStep.MIGRATING && (
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => step !== AppStep.LOGIN && setStep(AppStep.FILTER_INPUT)}>
              <div className="w-8 h-8 bg-facebook-blue rounded-full flex items-center justify-center text-white font-bold">
                <i className="fas fa-exchange-alt text-xs"></i>
              </div>
              <span className="font-bold text-facebook-blue tracking-tight">SocialMigrate AI</span>
              {mode === 'live' && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Live</span>}
            </div>
            {step !== AppStep.LOGIN && (
               <div className="flex items-center gap-3">
                 <img src={currentUser.avatar} className="w-8 h-8 rounded-full border border-gray-200 opacity-70 grayscale" alt="Old" />
                 <i className="fas fa-arrow-right text-gray-300 text-xs"></i>
                 <img src={destinationUser.avatar} className="w-8 h-8 rounded-full border border-gray-200" alt="New" />
               </div>
            )}
          </div>
        </header>
      )}

      <main>
        {step === AppStep.LOGIN && renderLogin()}
        {step === AppStep.FILTER_INPUT && renderFilterInput()}
        {step === AppStep.REVIEW && renderReview()}
        {step === AppStep.MIGRATING && renderMigrating()}
        {step === AppStep.COMPLETED && renderCompleted()}
      </main>
    </div>
  );
};

export default App;