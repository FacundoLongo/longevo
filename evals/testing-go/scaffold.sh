#!/usr/bin/env bash
# A small Go package with a real in-memory store, like Primo's policy example.
set -euo pipefail
cat > go.mod <<'GO'
module example.com/policies

go 1.21
GO
cat > store.go <<'GO'
package policies

// MemStore is the real store for this package: policies live in memory.
type MemStore struct{ byNumber map[string]Policy }

func NewMemStore() *MemStore { return &MemStore{byNumber: map[string]Policy{}} }

func (s *MemStore) Insert(p Policy) { s.byNumber[p.Number] = p }

func (s *MemStore) Get(number string) (Policy, bool) {
	p, ok := s.byNumber[number]
	return p, ok
}
GO
cat > policies.go <<'GO'
package policies

import "errors"

type Policy struct {
	Number   string
	Currency string
}

var ErrMissingNumber = errors.New("policy number is missing")

// ProcessRows stores the ARS policies and drops the rest. It returns how many it stored.
func ProcessRows(store *MemStore, rows []Policy) (int, error) {
	stored := 0
	for _, row := range rows {
		if row.Number == "" {
			return stored, ErrMissingNumber
		}
		if row.Currency != "ARS" {
			continue
		}
		store.Insert(row)
		stored++
	}
	return stored, nil
}
GO
