module.exports = {
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', {
      preset: 'angular',
      releaseRules: [
        { type: 'perf', release: 'patch' },
      ],
    }],
    '@semantic-release/release-notes-generator',

    // Publishes to GitHub Packages (npm.pkg.github.com)
    // Uses NPM_TOKEN env var set in the workflow
    ['@semantic-release/npm', {
      npmPublish: true,
    }],

    // Creates the GitHub Release + attaches changelog
    '@semantic-release/github',
  ],
};
