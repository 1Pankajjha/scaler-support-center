import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Settings, LogOut, Search, Plus, Edit2, Trash2, Eye, RefreshCw } from 'lucide-react';
import '../styles/AdminDashboard.css';

const API_URL = 'https://scaler-support-center-backend-production.up.railway.app/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('faqs');
  
  // Data States
  const [articles, setArticles] = useState([]);
  const [insights, setInsights] = useState(null);

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

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) navigate('/admin/login');
    else {
      fetchArticles();
      fetchInsights();
    }
  }, [navigate]);

  const fetchArticles = async () => {
    try {
      const res = await fetch(`${API_URL}/articles`);
      const data = await res.json();
      setArticles(data);
    } catch (e) {
      console.error('Failed to fetch articles');
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
      const res = await fetch(`${API_URL}/admin/insights`);
      const data = await res.json();
      setInsights(data);
    } catch (e) {
      console.error('Failed to fetch insights');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_email');
    navigate('/admin/login');
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
    const method = editingArticle ? 'PUT' : 'POST';
    const url = editingArticle ? `${API_URL}/articles/${editingArticle}` : `${API_URL}/articles`;
    
    try {
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      setIsModalOpen(false);
      fetchArticles();
    } catch (e) {
      console.error('Failed to save article');
    }
  };

  const handleDeleteArticle = async (id) => {
    if(!window.confirm('Are you sure you want to delete this article permanently?')) return;
    try {
      await fetch(`${API_URL}/articles/${id}`, { method: 'DELETE' });
      fetchArticles();
    } catch(e) {
      console.error('Failed to delete article');
    }
  };

  const uniqueCategories = ['All', ...new Set(articles.map(a => a.category))];
  
  const filteredArticles = articles.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'All' || a.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Scaler Admin</h2>
          <p className="admin-email">{localStorage.getItem('admin_email')}</p>
        </div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'faqs' ? 'active' : ''}`} onClick={() => setActiveTab('faqs')}>
            <FileText size={18} /> FAQ Management
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
          <h1>{activeTab === 'faqs' ? 'FAQ Management' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1) + ' Dashboard'}</h1>
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

          {activeTab === 'insights' && insights && (
            <div className="insights-view">
              <div className="metric-cards">
                <div className="card"><h3>Total Open</h3><p>{insights.openTickets}</p></div>
                <div className="card warning"><h3>&gt;12 Hours</h3><p>0</p></div>
                <div className="card danger"><h3>Escalations</h3><p>0</p></div>
                <div className="card text-danger"><h3>Detractors</h3><p>0</p></div>
              </div>
              <div className="placeholder-box">Detailed Ticket Logs Pending System Integration</div>
            </div>
          )}

          {/* Other tabs remain placeholders */}
          {(activeTab === 'team' || activeTab === 'reports') && (
            <div className="placeholder-box">Admin Module Integration Pending</div>
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
                <button type="button" className="cancel-btn" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="save-btn">{editingArticle ? 'Save Changes' : 'Create Article'}</button>
              </div>
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
    </div>
  );
};

export default AdminDashboard;
