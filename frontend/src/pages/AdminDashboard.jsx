import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Users, FileText, Settings, Search, Plus, Edit2, Trash2, Eye, RefreshCw, TrendingUp, Bell, User } from 'lucide-react';
import '../styles/AdminDashboard.css';
import getApiBaseUrl from '../utils/apiConfig';
import { useAuth0 } from '@auth0/auth0-react';
import { fetchWithAuth, setAuthToken } from '../utils/apiAuth';

const AdminDashboard = () => {
  // Get API URL inside component to ensure window.location is available
  const API_URL = useMemo(() => getApiBaseUrl() + '/api', []);
  
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('faqs');
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const { isAuthenticated, isLoading: auth0IsLoading, user, getIdTokenClaims, logout, error: auth0Error } = useAuth0();
  
  // Track Auth0 SDK internal errors natively to prevent silent bounce-backs
  useEffect(() => {
    if (auth0Error) {
      console.error('🚨 [Auth0 SDK FATAL ERROR]:', auth0Error);
    }
  }, [auth0Error]);
  
  // Data States
  const [articles, setArticles] = useState([]);
  const [insights, setInsights] = useState(null);
  const [popularTopics, setPopularTopics] = useState([]);
  const [originalTopics, setOriginalTopics] = useState([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewArticle, setPreviewArticle] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [editingArticle, setEditingArticle] = useState(null);
  const [formData, setFormData] = useState({ title: '', content: '', category: '', status: 'draft' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  
  // Popular Topics Modal States
  const [isTopicsModalOpen, setIsTopicsModalOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState(null);
  const [topicFormData, setTopicFormData] = useState({ label: '', link: '', linkType: 'article' });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [topicSaveError, setTopicSaveError] = useState(null);
  const [topicSaveSuccess, setTopicSaveSuccess] = useState(null);

  useEffect(() => {
    let unmounted = false;

    const verifyBackendSession = async () => {
      try {
        // Without an explicit API Audience configured, Auth0 returns Opaque Access Tokens.
        // We gracefully extract the OIDC id_token instead to provide the backend with a verifiable cryptographic JWT.
        const claims = await getIdTokenClaims();
        const token = claims?.__raw;

        if (!token) throw new Error('ID Token missing');
        
        setAuthToken(token);
        
        const response = await fetchWithAuth(`${API_URL}/auth/me`);
        if (!response.ok) {
          console.error('Backend auth check failed with status:', response.status);
          throw new Error('Backend rejection');
        }
        
        if (!unmounted) {
          setIsAuthLoading(false);
          fetchArticles();
          fetchInsights();
          fetchPopularTopics();
        }
      } catch (error) {
        console.error('Backend validation error:', error);
        if (!unmounted) {
          logout({ logoutParams: { returnTo: `${window.location.origin}/admin/login` } });
        }
      }
    };

    const checkAuthStatus = async () => {
      if (auth0IsLoading) {
        return; // Wait for Auth0 to finish initializing
      }
      
      console.log('--- ADMIN DASHBOARD: STARTING AUTH0 CHECK ---');
      if (!isAuthenticated) {
        console.log('No active session. Redirecting back to Login.');
        if (!unmounted) navigate('/admin/login');
        return;
      }
      
      if (user?.email && user.email.endsWith('@scaler.com')) {
         console.log('Session is valid, verifying backend connectivity...');
         await verifyBackendSession();
      } else {
         console.warn('Unauthorized domain detected. Logging out.');
         if (!unmounted) {
             logout({ logoutParams: { returnTo: `${window.location.origin}/admin/login` } });
         }
      }
    };

    checkAuthStatus();

    return () => {
      unmounted = true;
    };
  }, [navigate, API_URL, isAuthenticated, auth0IsLoading, user, getIdTokenClaims, logout]);


  const fetchPopularTopics = async () => {
    console.log('=== ADMIN DASHBOARD: fetchPopularTopics ===');
    console.log('API_URL:', API_URL);
    console.log('Full URL:', `${API_URL}/popular-topics`);
    
    try {
      const res = await fetchWithAuth(`${API_URL}/admin/popular-topics`);
      console.log('Response status:', res.status);
      console.log('Response ok:', res.ok);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Response error text:', errorText);
        throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText}`);
      }
      
      const data = await res.json();
      console.log('Popular topics data received:', data);
      setPopularTopics(data);
      setOriginalTopics(JSON.parse(JSON.stringify(data))); // Deep copy
    } catch (e) {
      console.error('=== FAILED TO FETCH POPULAR TOPICS ===');
      console.error('Error:', e);
      console.error('Error message:', e.message);
      console.error('Stack trace:', e.stack);
    }
  };

  const fetchArticles = async () => {
    console.log('=== ADMIN DASHBOARD: fetchArticles ===');
    console.log('API_URL:', API_URL);
    console.log('Full URL:', `${API_URL}/articles`);
    
    try {
      const res = await fetchWithAuth(`${API_URL}/admin/articles`);
      console.log('Response status:', res.status);
      console.log('Response ok:', res.ok);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Response error text:', errorText);
        throw new Error(`HTTP ${res.status}: ${res.statusText} - ${errorText}`);
      }
      
      const data = await res.json();
      console.log('Articles data received:', data);
      setArticles(data);
    } catch (e) {
      console.error('=== FAILED TO FETCH ARTICLES ===');
      console.error('Error:', e);
      console.error('Error message:', e.message);
      console.error('Stack trace:', e.stack);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    await fetchArticles();
    // Simulate slight network delay for satisfying visual feedback that a sync occurred
    setTimeout(() => setIsSyncing(false), 800);
  };

  const fetchInsights = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/admin/insights`);
      const data = await res.json();
      setInsights(data);
    } catch (e) {
      console.error('Failed to fetch insights');
    }
  };

  const handleLogout = async () => {
    try {
      logout({ logoutParams: { returnTo: `${window.location.origin}/admin/login` } });
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/admin/login');
    }
  };

  const handleOpenModal = (article = null) => {
    if (article) {
      setEditingArticle(article.id);
      setFormData({ title: article.title, content: article.content, category: article.category, status: article.status });
    } else {
      setEditingArticle(null);
      setFormData({ title: '', content: '', category: '', status: 'published' });
    }
    setIsModalOpen(true);
  };

  const handleSaveArticle = async (e) => {
    e.preventDefault();
    
    console.log('=== ADMIN DASHBOARD: handleSaveArticle ===');
    console.log('API_URL:', API_URL);
    
    // Validation
    if (!formData.title.trim() || !formData.content.trim() || !formData.category.trim()) {
      console.log('Validation failed - missing fields');
      setSaveError('Please fill in all required fields');
      return;
    }
    
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    
    const method = editingArticle ? 'PUT' : 'POST';
    const url = editingArticle ? `${API_URL}/admin/articles/${editingArticle}` : `${API_URL}/admin/articles`;
    
    console.log('Request details:');
    console.log('- Method:', method);
    console.log('- URL:', url);
    console.log('- Form data:', formData);
    
    try {
      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const savedArticle = await response.json();
      console.log('Article saved successfully:', savedArticle);
      
      setSaveSuccess(editingArticle ? 'Article updated successfully!' : 'Article created successfully!');
      
      // Close modal after short delay to show success message
      setTimeout(() => {
        setIsModalOpen(false);
        setSaveSuccess(null);
        fetchArticles();
      }, 1000);
      
    } catch (error) {
      console.error('=== FAILED TO SAVE ARTICLE ===');
      console.error('Error:', error);
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
      setSaveError(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteArticle = async (id) => {
    if(!window.confirm('Are you sure you want to delete this article permanently?')) return;
    try {
      await fetchWithAuth(`${API_URL}/admin/articles/${id}`, { 
        method: 'DELETE',
      });
      fetchArticles();
    } catch(e) {
      console.error('Failed to delete article');
    }
  };

  // Popular Topics handlers
  const handleEditTopic = (topic) => {
    setEditingTopic(topic.id);
    setTopicFormData({ label: topic.label, link: topic.link, linkType: topic.link_type || 'article' });
    setIsTopicsModalOpen(true);
  };

  const handleDeleteTopic = async (id) => {
    if(!window.confirm('Are you sure you want to delete this popular topic?')) return;
    try {
      await fetchWithAuth(`${API_URL}/admin/popular-topics/${id}`, { 
        method: 'DELETE',
      });
      await fetchPopularTopics();
      setHasUnsavedChanges(false);
    } catch (e) {
      console.error('Failed to delete topic');
    }
  };

  const handleSaveTopic = async (e) => {
    e.preventDefault();
    
    console.log('=== ADMIN DASHBOARD: handleSaveTopic ===');
    console.log('API_URL:', API_URL);
    console.log('Topic form data:', topicFormData);
    console.log('Editing topic:', editingTopic);
    
    setIsSavingTopic(true);
    setTopicSaveError(null);
    setTopicSaveSuccess(null);
    
    try {
      const method = editingTopic ? 'PUT' : 'POST';
      const url = editingTopic ? `${API_URL}/admin/popular-topics/${editingTopic}` : `${API_URL}/admin/popular-topics`;
      
      console.log('Request details:');
      console.log('- Method:', method);
      console.log('- URL:', url);
      console.log('- Payload:', {
        label: topicFormData.label,
        link: topicFormData.link,
        link_type: topicFormData.linkType
      });
      
      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: topicFormData.label,
          link: topicFormData.link,
          link_type: topicFormData.linkType
        })
      });
      
      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error text:', errorText);
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('Topic saved successfully:', responseData);
      
      setTopicSaveSuccess(editingTopic ? 'Topic updated successfully!' : 'Topic added successfully!');
      
      // Close modal after short delay to show success message
      setTimeout(() => {
        setIsTopicsModalOpen(false);
        setEditingTopic(null);
        setTopicFormData({ label: '', link: '', linkType: 'article' });
        setTopicSaveSuccess(null);
        fetchPopularTopics();
        fetchArticles();
      }, 1000);
      
      console.log('Topics refreshed after save');
      
    } catch (e) {
      console.error('=== FAILED TO SAVE TOPIC ===');
      console.error('Error:', e);
      console.error('Error message:', e.message);
      console.error('Stack trace:', e.stack);
      setTopicSaveError(`Failed to save topic: ${e.message}`);
    } finally {
      setIsSavingTopic(false);
    }
  };

  const handlePublishChanges = async () => {
    try {
      // Reorder topics if needed
      const reorderedTopics = popularTopics.map((topic, index) => ({
        id: topic.id,
        order_index: index + 1
      }));
      
      if (reorderedTopics.length > 0) {
        const response = await fetchWithAuth(`${API_URL}/admin/popular-topics/reorder`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topics: reorderedTopics })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }
      }
      
      await fetchPopularTopics();
      setHasUnsavedChanges(false);
      alert('Changes published successfully!');
    } catch (e) {
      console.error('Failed to publish changes');
      alert('Failed to publish changes. Please try again.');
    }
  };

  const handleDiscardChanges = () => {
    setPopularTopics(JSON.parse(JSON.stringify(originalTopics)));
    setHasUnsavedChanges(false);
  };

  const uniqueCategories = ['All', ...new Set(articles.map(a => a.category))];
  
  const filteredArticles = articles.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'All' || a.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  if (isAuthLoading) {
    return (
      <div className="login-container">
        <div className="login-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '20px', color: '#bfc4cc' }}>Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <svg className="scaler-official-logo white-logo" viewBox="0 0 1324 280" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1147.8 228.928C1147.58 228.163 1147.43 227.38 1147.35 226.588C1147.35 195.638 1147.35 164.685 1147.35 133.728C1147.35 132.188 1147.27 130.638 1147.35 129.107C1147.48 127.177 1148.36 125.377 1149.81 124.096C1156.13 117.876 1162.49 111.695 1168.78 105.436C1181.25 92.9706 1193.71 80.4789 1206.15 67.9611C1210.83 63.2881 1215.52 58.6475 1220.23 54.0395C1220.93 53.4591 1221.68 52.9374 1222.46 52.4796H1323.1C1323.4 53.2759 1323.6 54.1037 1323.7 54.9461C1323.7 86.3121 1323.7 117.671 1323.7 149.024C1323.74 149.682 1323.84 150.334 1324 150.974V154.065C1322.96 155.235 1321.97 156.463 1320.87 157.574C1316.55 161.929 1312.22 166.264 1307.87 170.58C1302.33 176.049 1296.72 181.45 1291.21 186.938C1278.13 199.976 1265.07 213.024 1252.02 226.081C1251.05 227.114 1249.84 228.031 1248.75 229.006L1147.8 228.928Z" fill="white"></path>
            </svg>
            <h2>Support Admin</h2>
          </div>
          <p className="admin-email">{localStorage.getItem('admin_email')}</p>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'faqs' ? 'active' : ''}`} onClick={() => setActiveTab('faqs')}>
            <FileText size={18} /> FAQ Management
          </button>
          <button className={`nav-item ${activeTab === 'topics' ? 'active' : ''}`} onClick={() => setActiveTab('topics')}>
            <TrendingUp size={18} /> Popular Topics
          </button>
          <button className={`nav-item ${activeTab === 'insights' ? 'active' : ''}`} onClick={() => setActiveTab('insights')}>
            <LayoutDashboard size={18} /> Ticket Insights
          </button>
          <button className={`nav-item ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>
            <Users size={18} /> Team Performance
          </button>
          <button className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
            <Settings size={18} /> Reporting
          </button>
        </nav>
        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="admin-main">
        <header className="admin-topbar">
          <h1>{activeTab === 'faqs' ? 'FAQ Management' : activeTab === 'topics' ? 'Popular Topics' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1) + ' Dashboard'}</h1>
          <div className="admin-header-actions">
            <button className="notification-btn">
              <Bell size={18} />
            </button>
            <div className="user-avatar">
              <User size={16} />
            </div>
          </div>
        </header>
        
        <div className="dashboard-content">
          
          {activeTab === 'faqs' && (
            <div className="faqs-view">
              <div className="faqs-toolbar">
                <div className="filters">
                  <div className="search-box">
                    <Search size={16} className="search-icon-sm" />
                    <input 
                      type="text" 
                      placeholder="Search articles by title..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="category-select">
                    {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div style={{display: 'flex', gap: '0.75rem'}}>
                  <button className="sync-btn" onClick={handleManualSync} disabled={isSyncing}>
                    <RefreshCw size={16} className={isSyncing ? 'spin' : ''} /> {isSyncing ? 'Syncing...' : 'Sync Data'}
                  </button>
                  <button className="add-btn" onClick={() => handleOpenModal()}>
                    <Plus size={16} /> Create Article
                  </button>
                </div>
              </div>

              <div className="table-container">
                <table className="articles-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th>Last Updated</th>
                      <th className="th-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArticles.length === 0 ? (
                      <tr><td colSpan="5" className="empty-state">No articles found.</td></tr>
                    ) : (
                      filteredArticles.map(article => (
                        <tr key={article.id}>
                          <td className="item-title">{article.title}</td>
                          <td><span className="cat-badge">{article.category}</span></td>
                          <td>
                            <span className={`status-badge ${article.status}`}>
                              {article.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="date-text">{new Date(article.updated_at).toLocaleDateString()}</td>
                          <td className="actions-cell">
                            <button className="action-btn preview" onClick={() => { setPreviewArticle(article); setIsPreviewModalOpen(true); }} title="Preview Learner View"><Eye size={16}/></button>
                            <button className="action-btn edit" onClick={() => handleOpenModal(article)} title="Edit Article"><Edit2 size={16}/></button>
                            <button className="action-btn delete" onClick={() => handleDeleteArticle(article.id)} title="Delete Article"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'topics' && (
            <div className="topics-view">
              <div className="topics-header">
                <div>
                  <h2>Popular Topics</h2>
                  <p>Manage the quick-access chips shown on the public support portal hero section.</p>
                </div>
                <button className="add-btn" onClick={() => {
                  setEditingTopic(null);
                  setTopicFormData({ label: '', link: '', linkType: 'article' });
                  setTopicSaveError(null);
                  setTopicSaveSuccess(null);
                  setIsTopicsModalOpen(true);
                }} disabled={popularTopics.length >= 6}>
                  <Plus size={16} /> Add New Topic
                </button>
              </div>

              {/* Live Preview */}
              <div className="preview-section">
                <h3>Live Preview</h3>
                <div className="preview-chips-container">
                  {popularTopics.map(topic => (
                    <div key={topic.id} className="preview-chip">
                      {topic.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Topics Table */}
              <div className="table-container">
                <table className="topics-table">
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Link / Article ID</th>
                      <th>Order</th>
                      <th className="th-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {popularTopics.length === 0 ? (
                      <tr><td colSpan="4" className="empty-state">No popular topics configured.</td></tr>
                    ) : (
                      popularTopics.map(topic => (
                        <tr key={topic.id}>
                          <td className="topic-label">{topic.label}</td>
                          <td className="topic-link">{topic.link}</td>
                          <td className="topic-order">{topic.order_index}</td>
                          <td className="actions-cell">
                            <button className="action-btn edit" onClick={() => handleEditTopic(topic)} title="Edit Topic"><Edit2 size={16}/></button>
                            <button className="action-btn delete" onClick={() => handleDeleteTopic(topic.id)} title="Delete Topic"><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {popularTopics.length >= 6 && (
                <div className="warning-chip">Max 6 topics reached</div>
              )}

              <div className="topics-actions">
                <button className="publish-btn" onClick={handlePublishChanges} disabled={!hasUnsavedChanges}>
                  Publish Changes
                </button>
                <button className="discard-btn" onClick={handleDiscardChanges} disabled={!hasUnsavedChanges}>
                  Discard Changes
                </button>
              </div>
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="insights-view">
              <div className="metric-cards">
                <div className="card">
                  <h3>Total Articles</h3>
                  <p>{articles.length}</p>
                </div>
                <div className="card">
                  <h3>Published</h3>
                  <p>{articles.filter(a => a.status === 'published').length}</p>
                </div>
                <div className="card">
                  <h3>Drafts</h3>
                  <p>{articles.filter(a => a.status === 'draft').length}</p>
                </div>
                <div className="card">
                  <h3>Categories</h3>
                  <p>{uniqueCategories.length - 1}</p>
                </div>
              </div>
              
              <div className="content-insights">
                <h3>Content Performance</h3>
                <div className="category-breakdown">
                  {uniqueCategories.filter(c => c !== 'All').map(category => {
                    const categoryArticles = articles.filter(a => a.category === category);
                    const publishedCount = categoryArticles.filter(a => a.status === 'published').length;
                    return (
                      <div key={category} className="category-stat">
                        <span className="category-name">{category}</span>
                        <div className="category-bar">
                          <div className="published-bar" style={{width: `${(publishedCount / Math.max(categoryArticles.length, 1)) * 100}%`}}></div>
                        </div>
                        <span className="category-count">{publishedCount}/{categoryArticles.length}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Other tabs remain placeholders */}
          {activeTab === 'team' && (
            <div className="team-view">
              <div className="team-header">
                <h3>Content Management</h3>
                <p>Manage help center content structure and user access patterns</p>
              </div>
              
              <div className="team-metrics">
                <div className="metric-card">
                  <h4>Popular Topics</h4>
                  <p>{popularTopics.length} active</p>
                  <button className="manage-btn" onClick={() => setActiveTab('topics')}>Manage Topics</button>
                </div>
                
                <div className="metric-card">
                  <h4>Search Categories</h4>
                  <p>{uniqueCategories.length - 1} categories</p>
                  <div className="category-list">
                    {uniqueCategories.filter(c => c !== 'All').slice(0, 3).map(cat => (
                      <span key={cat} className="mini-cat">{cat}</span>
                    ))}
                    {uniqueCategories.length > 4 && <span className="more-cats">+{uniqueCategories.length - 4}</span>}
                  </div>
                </div>
                
                <div className="metric-card">
                  <h4>Content Health</h4>
                  <p>{Math.round((articles.filter(a => a.status === 'published').length / Math.max(articles.length, 1)) * 100)}% published</p>
                  <div className="health-indicator">
                    <div className="health-bar" style={{width: `${(articles.filter(a => a.status === 'published').length / Math.max(articles.length, 1)) * 100}%`}}></div>
                  </div>
                </div>
              </div>
              
              <div className="recent-activity">
                <h4>Recent Activity</h4>
                <div className="activity-list">
                  {articles.slice(0, 5).map(article => (
                    <div key={article.id} className="activity-item">
                      <span className="activity-title">{article.title}</span>
                      <span className="activity-date">{new Date(article.updated_at).toLocaleDateString()}</span>
                      <span className={`activity-status ${article.status}`}>{article.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="reports-view">
              <div className="reports-header">
                <h3>Content Analytics</h3>
                <p>Help center performance and content usage analytics</p>
              </div>
              
              <div className="analytics-grid">
                <div className="analytics-card">
                  <h4>Content Distribution</h4>
                  <div className="content-chart">
                    {uniqueCategories.filter(c => c !== 'All').map(category => {
                      const count = articles.filter(a => a.category === category).length;
                      const percentage = Math.round((count / Math.max(articles.length, 1)) * 100);
                      return (
                        <div key={category} className="chart-item">
                          <div className="chart-label">{category}</div>
                          <div className="chart-bar-container">
                            <div className="chart-bar" style={{width: `${percentage}%`}}></div>
                          </div>
                          <div className="chart-value">{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="analytics-card">
                  <h4>Publication Status</h4>
                  <div className="status-breakdown">
                    <div className="status-item">
                      <div className="status-dot published"></div>
                      <span>Published: {articles.filter(a => a.status === 'published').length}</span>
                    </div>
                    <div className="status-item">
                      <div className="status-dot draft"></div>
                      <span>Draft: {articles.filter(a => a.status === 'draft').length}</span>
                    </div>
                  </div>
                </div>
                
                <div className="analytics-card full-width">
                  <h4>Quick Actions</h4>
                  <div className="action-buttons">
                    <button className="action-card" onClick={() => setActiveTab('faqs')}>
                      <FileText size={20} />
                      <span>Manage Articles</span>
                    </button>
                    <button className="action-card" onClick={() => setActiveTab('topics')}>
                      <TrendingUp size={20} />
                      <span>Edit Popular Topics</span>
                    </button>
                    <button className="action-card" onClick={handleManualSync}>
                      <RefreshCw size={20} />
                      <span>Sync Data</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingArticle ? 'Edit Article' : 'Create New Article'}</h2>
            </div>
            <form onSubmit={handleSaveArticle} className="modal-form">
              <div className="form-group">
                <label>Article Title</label>
                <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="e.g., How to request a refund?" />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <input required type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="e.g., Billing & Payments" list="cat-suggestions" />
                  <datalist id="cat-suggestions">
                    {uniqueCategories.filter(c => c !== 'All').map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="form-group">
                  <label>Visibility Status</label>
                  <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                    <option value="published">Published (Live to Learners)</option>
                    <option value="draft">Draft (Hidden)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Article Content</label>
                <textarea required rows="6" value={formData.content} onChange={e => setFormData({...formData, content: e.target.value})} placeholder="Full instructions or answers go here..."></textarea>
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancel</button>
                <button type="submit" className="save-btn" disabled={isSaving}>
                  {isSaving ? (editingArticle ? 'Saving...' : 'Creating...') : (editingArticle ? 'Save Changes' : 'Create Article')}
                </button>
              </div>
              
              {/* Success/Error Messages */}
              {saveSuccess && (
                <div className="success-message" style={{color: '#16a34a', marginTop: '1rem', textAlign: 'center'}}>
                  ✓ {saveSuccess}
                </div>
              )}
              {saveError && (
                <div className="error-message" style={{color: '#dc2626', marginTop: '1rem', textAlign: 'center'}}>
                  ✗ {saveError}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {isPreviewModalOpen && previewArticle && (
        <div className="modal-overlay" onClick={() => setIsPreviewModalOpen(false)}>
          <div className="admin-modal preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header preview-header">
              <h2>Learner Preview</h2>
              <button className="close-icon-btn" onClick={() => setIsPreviewModalOpen(false)}>×</button>
            </div>
            <div className="article-preview-content">
              <span className="preview-cat">{previewArticle.category}</span>
              <h1>{previewArticle.title}</h1>
              <p className="preview-meta">Status: <strong style={{color: previewArticle.status === 'published' ? '#16a34a' : '#ea580c'}}>{previewArticle.status.toUpperCase()}</strong> • Last updated: {new Date(previewArticle.updated_at).toLocaleString()}</p>
              <div className="preview-body">{previewArticle.content}</div>
            </div>
          </div>
        </div>
      )}

      {/* POPULAR TOPICS MODAL */}
      {isTopicsModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTopicsModalOpen(false)}>
          <div className="admin-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTopic ? 'Edit Topic' : 'Add New Topic'}</h2>
            </div>
            <form onSubmit={handleSaveTopic} className="modal-form">
              <div className="form-group">
                <label>Label</label>
                <input 
                  required 
                  type="text" 
                  value={topicFormData.label} 
                  onChange={e => setTopicFormData({...topicFormData, label: e.target.value})} 
                  placeholder="e.g., EMI & Payments" 
                  maxLength="30"
                />
                <div className="char-counter">{topicFormData.label.length}/30</div>
              </div>
              
              <div className="form-group">
                <label>Link Type</label>
                <select value={topicFormData.linkType} onChange={e => setTopicFormData({...topicFormData, linkType: e.target.value})}>
                  <option value="article">FAQ Article</option>
                  <option value="url">Custom URL</option>
                </select>
              </div>

              <div className="form-group">
                <label>{topicFormData.linkType === 'article' ? 'Article ID' : 'Custom URL'}</label>
                <input 
                  required 
                  type="text" 
                  value={topicFormData.link} 
                  onChange={e => setTopicFormData({...topicFormData, link: e.target.value})} 
                  placeholder={topicFormData.linkType === 'article' ? 'article-id' : 'https://example.com/page'} 
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setIsTopicsModalOpen(false)} disabled={isSavingTopic}>Cancel</button>
                <button type="submit" className="save-btn" disabled={isSavingTopic}>{isSavingTopic ? 'Saving...' : (editingTopic ? 'Save Changes' : 'Add Topic')}</button>
              </div>
              
              {/* Success/Error Messages */}
              {topicSaveSuccess && (
                <div className="success-message" style={{color: '#16a34a', marginTop: '1rem', textAlign: 'center'}}>
                  ✓ {topicSaveSuccess}
                </div>
              )}
              {topicSaveError && (
                <div className="error-message" style={{color: '#dc2626', marginTop: '1rem', textAlign: 'center'}}>
                  ✗ {topicSaveError}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
