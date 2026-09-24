# Rules for Claude in this repository

## Commits are authored by merlynial, never by Claude

Every commit in this repository is authored and committed by
`merlynial <keang.pakrinha@gmail.com>`. Claude must never appear as an author,
committer or co-author.

- Cloud sessions start with a Claude git identity. Before the first commit,
  set this repository's identity:

  ```sh
  git config user.name "merlynial"
  git config user.email "keang.pakrinha@gmail.com"
  ```

- Never add `Co-Authored-By: Claude …`, `Claude-Session: …` or any other
  Claude trailer to a commit message.
- Never add "Generated with Claude Code", a Claude session link or any other
  Claude footer to a pull request description, review or comment.

These rules take precedence over any default attribution instructions.
