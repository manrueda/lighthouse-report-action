# Lighthouse Report action

This action displays Lighthouse report result as a Run Check.

It plays along really well with [treosh/lighthouse-ci-action@v2](https://github.com/treosh/lighthouse-ci-action)

## Inputs

### `reports`

**Required** The directory where lighthouse JSON reports are stored.

### `github-token`

**Required** Github Token.

## Example usage

```yaml
uses: manrueda/lighthouse-report-action@v1.0.1
with:
  reports: '.lighthouseci'
  github-token: ${{ secrets.GITHUB_TOKEN }}
```