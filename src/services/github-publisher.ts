import { Octokit } from '@octokit/rest'
import simpleGit from 'simple-git'

export class GitHubPublisher {
  private octokit: Octokit
  private githubAccessToken: string

  constructor(options: { octokit: Octokit; githubAccessToken: string }) {
    this.octokit = options.octokit
    this.githubAccessToken = options.githubAccessToken
  }

  public async publish(repoName: string): Promise<void> {
    // Export site to GitHub
    await Promise.all([
      this.octokit.repos.createInOrg({
        org: 'isomerpages',
        name: repoName,
        description: `Staging: https://${repoName}-staging.netlify.app | Production: https://${repoName}-prod.netlify.app`,
        visibility: 'public',
      }),
      this.octokit.teams.create({
        org: 'isomerpages',
        name: repoName,
        privacy: 'closed',
      }),
    ])

    const git = simpleGit({
      baseDir: `/tmp/${repoName}`,
    })

    await git
      .init()
      .add('.')
      .commit('Initial commit')
      .addRemote(
        'origin',
        `https://user:${this.githubAccessToken}@github.com/isomerpages/${repoName}`
      )
      .branch(['-m', 'staging'])
      .push('origin', 'staging', { '-u': null })
      .checkoutBranch('master', 'HEAD')
      .push('origin', 'master', { '-u': null })

    await Promise.all([
      this.octokit.repos.updateBranchProtection({
        owner: 'isomerpages',
        repo: repoName,
        branch: 'master',
        required_pull_request_reviews: {
          required_approving_review_count: 1,
        },
        enforce_admins: true,
        required_status_checks: null,
        restrictions: null,
        // Enable custom media type to enable required_pull_request_reviews
        headers: {
          accept: 'application/vnd.github.luke-cage-preview+json',
        },
      }),
      this.octokit.teams.addOrUpdateRepoPermissionsInOrg({
        org: 'isomerpages',
        team_slug: 'core',
        owner: 'isomerpages',
        repo: repoName,
        permission: 'admin',
      }),
      this.octokit.teams.addOrUpdateRepoPermissionsInOrg({
        org: 'isomerpages',
        team_slug: repoName,
        owner: 'isomerpages',
        repo: repoName,
        permission: 'push',
      }),
    ])
  }
}
