# E2E findings

## F1 (resolved): phone touch targets

Board cells (~41px) and number-pad keys (~37px wide) on a 390px-wide phone cannot reach 44px with nine columns. The layout test now uses a 36px floor for cells and number-pad keys (WCAG 2.2 AA minimum is 24px) and 44px for every other control. Authored by the lead (Grok Bot) after the E stream's finding.
