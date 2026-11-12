# Information-only regulatory stance

## Context

In the UEMOA, giving investment advice, receiving orders or holding client funds are regulated activities (AMF-UMOA licensing for SGIs and advisers). Doni is built by a small team without such a licence. Several tempting features (recommendations, "buy" signals, order routing, paid placement for SGIs) would cross that line.

## Decision

Doni provides **information and education only**. It shows official data, computes figures from what the user enters, and publishes neutral guides. It never recommends buying or selling a security, never receives or routes orders, never holds money, and never accepts paid placement from SGIs. A disclaimer ("information and education only, not investment advice") is linked from every data page and from sign-up.

## Rejected alternatives

- **Recommendations or ratings** (buy/hold/sell, scores, model portfolios): would be investment advice.
- **Order routing or brokerage integration**: would make Doni an intermediary.
- **Paid SGI placement or referral fees**: would compromise the neutrality of the SGI directory and could be seen as solicitation.
- **AI-generated commentary on securities**: hard to keep on the information side of the line; deferred.

## Consequences

- The SGI directory is a neutral listing with sourced fees.
- Every figure is factual and labelled with its source, date and method.
- Features such as AI insights or a screener need a fresh look at this stance before they are built.
