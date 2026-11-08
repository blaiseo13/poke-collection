# Poké Collection decisions
- 11/07/26: Personal project in its own folder; data from the public PokemonTCG dataset + PokeAPI; prices via TCGdex (TCGplayer market).
- 11/07/26: His list = Pokémon he did NOT have (dot = missing / want; checkmark = just got, not filed). Unlisted Gen 1-4 = owned.
- 11/07/26: Word is "binder", never "book". Box = downstairs cards, shared across binders.
- 11/07/26: Website on GitHub Pages (blaiseo13.github.io/poke-collection), app shell like Conshy Eats; standing OK to push this repo.
- 11/07/26: Trending tab refreshed daily by GitHub Actions (TCGdex; Cardmarket 7d vs 30d momentum).
- 11/07/26: No Pokémon "game" (no roaming/battles with franchise characters); detail view shows animated sprites from PokeAPI instead.
- 11/08/26: Points system approved ("we can always update and optimize over time"): card points = rarity points (Common/Uncommon 1, Reverse Holo 3, Rare 5, Holo Rare 10, Ultra Rare 25, Secret/Illustration 60) + value points ($1 = 1 pt, capped at 500), x1.5 if the card is over 10 years old. Binder score = sum over his binder cards.
- 11/08/26: No paid data sources. One app for all his trading cards later (One Piece, Yu-Gi-Oh, sports), not now. App icon = "Card on Fire" (chosen in the Conshy session) + launch intro.
- 11/07/26: Move the record to Firebase (option A, like Conshy): edit on the website from any device with a private edit link, live everywhere, no sync step. Separate Firebase project from Conshy. The claude.ai Pokédex Binder page stays for photo scanning only; Claude copies scans over on request.
