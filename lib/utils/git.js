export const git = {
    "name": "git",
    "displayName": "git",
    "scopeName":"git",
    "fileTypes": ["gitignore", "git-attr", "gitconfig"],
    "patterns": [
      {
        "name": "keyword.control.git.command",
        "match": "\\b(add|commit|push|pull|checkout|branch|merge|status|log|clone|remote)\\b"
      },
      {
        "name": "constant.other.git.reference",
        "match": "\\b(HEAD|FETCH_HEAD|MERGE_HEAD|CHERRY_PICK_HEAD)\\b"
      },
      {
        "name": "storage.type.git.reference",
        "match": "\\b([a-fA-F0-9]{40})\\b"
      },
      {
        "name": "support.class.git.config",
        "match": "\\[(\\w[-:.\\w]*\\)"
      },
      {
        "name": "string.quoted.single.git",
        "begin": "'",
        "end": "'",
        "patterns": [
          {
            "include": "#string-contents"
          }
        ]
      },
      {
        "name": "string.quoted.double.git",
        "begin": "\"",
        "end": "\"",
        "patterns": [
          {
            "include": "#string-contents"
          }
        ]
      },
      {
        "name": "comment.line.git",
        "match": "#.*"
      },
      {
        "name": "string.unquoted.git",
        "match": "\\b(\\.\\./|\\.\\.\\.|master|main|HEAD)\\b"
      }
    ],
    "repository": {
      "string-contents": {
        "patterns": [
          {
            "include": "$self"
          }
        ]
      }
    }
  }