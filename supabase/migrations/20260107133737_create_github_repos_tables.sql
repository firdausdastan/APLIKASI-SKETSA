/*
  # GitHub Repository Manager Schema

  1. New Tables
    - `imported_repos`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `repo_id` (bigint, GitHub repository ID)
      - `name` (text, repository name)
      - `full_name` (text, full repository name with owner)
      - `description` (text, repository description)
      - `html_url` (text, GitHub URL)
      - `homepage` (text, project homepage)
      - `language` (text, primary language)
      - `stars` (integer, stargazers count)
      - `forks` (integer, forks count)
      - `open_issues` (integer, open issues count)
      - `topics` (jsonb, repository topics)
      - `created_at` (timestamptz, when saved)
      - `updated_at` (timestamptz, last update)
    
    - `repo_notes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `repo_id` (uuid, foreign key to imported_repos)
      - `note` (text, user's note)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own data
    - Authenticated users only
*/

-- Create imported_repos table
CREATE TABLE IF NOT EXISTS imported_repos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  repo_id bigint NOT NULL,
  name text NOT NULL,
  full_name text NOT NULL,
  description text DEFAULT '',
  html_url text NOT NULL,
  homepage text DEFAULT '',
  language text DEFAULT '',
  stars integer DEFAULT 0,
  forks integer DEFAULT 0,
  open_issues integer DEFAULT 0,
  topics jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, repo_id)
);

-- Create repo_notes table
CREATE TABLE IF NOT EXISTS repo_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  repo_id uuid REFERENCES imported_repos(id) ON DELETE CASCADE NOT NULL,
  note text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE imported_repos ENABLE ROW LEVEL SECURITY;
ALTER TABLE repo_notes ENABLE ROW LEVEL SECURITY;

-- Policies for imported_repos
CREATE POLICY "Users can view own imported repos"
  ON imported_repos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own imported repos"
  ON imported_repos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own imported repos"
  ON imported_repos FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own imported repos"
  ON imported_repos FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for repo_notes
CREATE POLICY "Users can view own notes"
  ON repo_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON repo_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON repo_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON repo_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_imported_repos_user_id ON imported_repos(user_id);
CREATE INDEX IF NOT EXISTS idx_imported_repos_repo_id ON imported_repos(repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_notes_user_id ON repo_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_repo_notes_repo_id ON repo_notes(repo_id);