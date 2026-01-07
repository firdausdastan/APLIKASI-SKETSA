import React, { useState, useEffect } from 'react';
import { supabase, ImportedRepo } from './lib/supabase';
import { searchGitHubRepos, GitHubRepo } from './lib/github';
import { AuthForm } from './components/AuthForm';
import { SearchBar } from './components/SearchBar';
import { RepoCard } from './components/RepoCard';
import { User } from 'npm:@supabase/supabase-js@2';
import {
  BookmarkCheck,
  Search as SearchIcon,
  LogOut,
  Loader2,
  Github,
  TrendingUp
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { cn } from './lib/utils';

type ViewMode = 'search' | 'imported';

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('search');

  const [searchResults, setSearchResults] = useState<GitHubRepo[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [importedRepos, setImportedRepos] = useState<ImportedRepo[]>([]);
  const [importedLoading, setImportedLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchImportedRepos();
    }
  }, [user]);

  const fetchImportedRepos = async () => {
    if (!user) return;

    setImportedLoading(true);
    try {
      const { data, error } = await supabase
        .from('imported_repos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setImportedRepos(data || []);
    } catch (error: any) {
      toast.error('Gagal memuat repository tersimpan');
      console.error(error);
    } finally {
      setImportedLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setSearchLoading(true);
    try {
      const results = await searchGitHubRepos(query);
      setSearchResults(results.items);
      if (results.items.length === 0) {
        toast.info('Tidak ada hasil ditemukan');
      }
    } catch (error: any) {
      toast.error('Gagal mencari repository');
      console.error(error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleImportRepo = async (repo: GitHubRepo) => {
    if (!user) return;

    try {
      const { error } = await supabase.from('imported_repos').insert({
        user_id: user.id,
        repo_id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description || '',
        html_url: repo.html_url,
        homepage: repo.homepage || '',
        language: repo.language || '',
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        open_issues: repo.open_issues_count,
        topics: repo.topics || [],
      });

      if (error) {
        if (error.code === '23505') {
          toast.info('Repository sudah ada di koleksi');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Repository berhasil disimpan!');
      await fetchImportedRepos();
    } catch (error: any) {
      toast.error('Gagal menyimpan repository');
      console.error(error);
    }
  };

  const handleRemoveRepo = async (repoId: number) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('imported_repos')
        .delete()
        .eq('user_id', user.id)
        .eq('repo_id', repoId);

      if (error) throw error;

      toast.success('Repository dihapus dari koleksi');
      await fetchImportedRepos();
    } catch (error: any) {
      toast.error('Gagal menghapus repository');
      console.error(error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSearchResults([]);
    setImportedRepos([]);
    toast.success('Berhasil keluar');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm onSuccess={() => {}} />;
  }

  const isRepoImported = (repoId: number) => {
    return importedRepos.some(r => r.repo_id === repoId);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Toaster position="top-center" />

      <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
                <Github className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">GitHub Manager</h1>
                <p className="text-xs text-gray-500">Kelola repository favorit Anda</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-sm text-gray-600">
                {user.email}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Keluar
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1">
            <button
              onClick={() => setViewMode('search')}
              className={cn(
                "flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors",
                viewMode === 'search'
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              )}
            >
              <SearchIcon className="w-4 h-4" />
              Cari Repository
            </button>
            <button
              onClick={() => setViewMode('imported')}
              className={cn(
                "flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors",
                viewMode === 'imported'
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              )}
            >
              <BookmarkCheck className="w-4 h-4" />
              Koleksi Saya
              {importedRepos.length > 0 && (
                <span className="bg-blue-100 text-blue-600 text-xs font-bold px-2 py-0.5 rounded-full">
                  {importedRepos.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === 'search' ? (
          <div className="space-y-8">
            <div className="flex flex-col items-center">
              <SearchBar onSearch={handleSearch} loading={searchLoading} />
              <p className="text-sm text-gray-500 mt-4">
                Temukan dan simpan repository GitHub terbaik
              </p>
            </div>

            {searchLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : searchResults.length > 0 ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Hasil pencarian untuk "{searchQuery}"
                  </h2>
                  <span className="text-sm text-gray-500">
                    {searchResults.length} repository
                  </span>
                </div>
                <div className="grid gap-4">
                  {searchResults.map((repo) => (
                    <RepoCard
                      key={repo.id}
                      repo={repo}
                      isImported={isRepoImported(repo.id)}
                      onImport={handleImportRepo}
                      onRemove={handleRemoveRepo}
                    />
                  ))}
                </div>
              </div>
            ) : searchQuery ? (
              <div className="text-center py-12">
                <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Tidak ada hasil untuk "{searchQuery}"</p>
              </div>
            ) : (
              <div className="text-center py-12">
                <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Mulai pencarian Anda
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                  Cari repository berdasarkan nama, bahasa, atau topik yang Anda minati
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Koleksi Repository</h2>
              <span className="text-sm text-gray-500">
                {importedRepos.length} repository tersimpan
              </span>
            </div>

            {importedLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : importedRepos.length > 0 ? (
              <div className="grid gap-4">
                {importedRepos.map((repo) => (
                  <RepoCard
                    key={repo.id}
                    repo={{
                      id: repo.repo_id,
                      name: repo.name,
                      full_name: repo.full_name,
                      description: repo.description,
                      html_url: repo.html_url,
                      homepage: repo.homepage,
                      stargazers_count: repo.stars,
                      forks_count: repo.forks,
                      open_issues_count: repo.open_issues,
                      language: repo.language,
                      topics: repo.topics,
                      owner: {
                        login: repo.full_name.split('/')[0],
                        avatar_url: `https://github.com/${repo.full_name.split('/')[0]}.png`,
                      },
                      created_at: repo.created_at,
                      updated_at: repo.updated_at,
                    }}
                    isImported={true}
                    onRemove={handleRemoveRepo}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <BookmarkCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Belum ada repository tersimpan
                </h3>
                <p className="text-gray-500 mb-4 max-w-md mx-auto">
                  Mulai cari dan simpan repository favorit Anda dari tab Cari Repository
                </p>
                <button
                  onClick={() => setViewMode('search')}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Mulai Mencari
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
