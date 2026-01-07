import React from 'react';
import { GitHubRepo } from '@/lib/github';
import { Star, GitFork, AlertCircle, ExternalLink, Bookmark, BookmarkCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RepoCardProps {
  repo: GitHubRepo;
  isImported?: boolean;
  onImport?: (repo: GitHubRepo) => void;
  onRemove?: (repoId: number) => void;
}

export const RepoCard: React.FC<RepoCardProps> = ({
  repo,
  isImported = false,
  onImport,
  onRemove
}) => {
  const handleAction = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isImported && onRemove) {
      onRemove(repo.id);
    } else if (!isImported && onImport) {
      onImport(repo);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all p-5 group">
      <div className="flex items-start gap-4">
        <img
          src={repo.owner.avatar_url}
          alt={repo.owner.login}
          className="w-12 h-12 rounded-lg"
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <a
                href={repo.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-gray-900 hover:text-blue-600 flex items-center gap-2 group/link"
              >
                <span className="truncate">{repo.full_name}</span>
                <ExternalLink className="w-4 h-4 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
              </a>
            </div>

            <button
              onClick={handleAction}
              className={cn(
                "p-2 rounded-lg transition-colors flex-shrink-0",
                isImported
                  ? "text-blue-600 bg-blue-50 hover:bg-blue-100"
                  : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
              )}
              title={isImported ? 'Hapus dari koleksi' : 'Simpan ke koleksi'}
            >
              {isImported ? (
                <BookmarkCheck className="w-5 h-5" />
              ) : (
                <Bookmark className="w-5 h-5" />
              )}
            </button>
          </div>

          <p className="text-sm text-gray-600 mt-2 line-clamp-2">
            {repo.description || 'Tidak ada deskripsi'}
          </p>

          <div className="flex flex-wrap items-center gap-4 mt-3">
            {repo.language && (
              <div className="flex items-center gap-1 text-sm">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-gray-700 font-medium">{repo.language}</span>
              </div>
            )}

            <div className="flex items-center gap-1 text-sm text-gray-600">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="font-medium">{repo.stargazers_count.toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-1 text-sm text-gray-600">
              <GitFork className="w-4 h-4" />
              <span className="font-medium">{repo.forks_count.toLocaleString()}</span>
            </div>

            {repo.open_issues_count > 0 && (
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">{repo.open_issues_count.toLocaleString()}</span>
              </div>
            )}
          </div>

          {repo.topics && repo.topics.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {repo.topics.slice(0, 5).map((topic) => (
                <span
                  key={topic}
                  className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-medium"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
