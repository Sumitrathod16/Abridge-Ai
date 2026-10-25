export function runGitHubAgent(gh) {
  const p = gh.profile;
  const lines = [];
  lines.push(`${p.name} (@${p.login})`);
  if (p.bio) lines.push(`Bio: ${p.bio}`);
  const meta = [];
  if (p.location) meta.push(p.location);
  if (p.company) meta.push(p.company);
  if (p.blog) meta.push(p.blog);
  if (meta.length) lines.push(`From: ${meta.join(' · ')}`);
  lines.push(`Public repos: ${p.publicRepos}  ·  Followers: ${p.followers}  ·  Following: ${p.following}`);

  const langs = gh.languages.slice(0, 5);
  if (langs.length) {
    lines.push('');
    lines.push('Languages used on GitHub:');
    lines.push(langs.map(l => `  ${l.language} (${l.count} repo${l.count > 1 ? 's' : ''})`).join('\n'));
  }

  // Builder profile — personalised language comfort signal
  if (langs.length) {
    lines.push('');
    lines.push('Builder appears comfortable with:');
    langs.slice(0, 3).forEach(l => lines.push(`  ✓ ${l.language}`));
    const lessComfortable = langs.slice(3);
    if (lessComfortable.length) {
      lines.push('Less represented:');
      lessComfortable.forEach(l => lines.push(`  ○ ${l.language}`));
    }
    lines.push('');
    lines.push('Recommendation: prefer familiar languages for the first version.');
  }

  if (gh.repos.length) {
    lines.push('');
    lines.push('Notable repositories:');
    gh.repos.forEach(r => {
      lines.push(`  • ${r.name}${r.stars ? ` ★${r.stars}` : ''}${r.language ? ` [${r.language}]` : ''}`);
      if (r.description) lines.push(`    ${r.description}`);
    });
  }

  return lines.join('\n');
}