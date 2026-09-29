---
title: 'As Solutions Scale, Research Needs Better Benchmarks'
description: 'AI agents are getting better at finding solutions. I think research should invest more in defining the problems we care about and what it means to solve them.'
date: '2026-09-30'
draft: false
lang: en
tags: [AI Agents, Research, Evaluation]
---

I think frontier AI is already very capable, especially when it comes to agents helping us get things done. As AI gets better at finding solutions, where should we put more of our effort as researchers?

My view is that we should spend more time designing good benchmarks, datasets, and evaluation protocols: defining the problems we care about and what it means to solve them.

**When finding solutions can scale, deciding what is worth solving becomes more important.**

## Finding solutions is getting easier

There are already experiments with hundreds of agents working concurrently on a single project, and products that coordinate thousands of subagents over long-running projects. The scale of work agents can take on has grown considerably. [Cursor's experiments](https://cursor.com/blog/scaling-agents), [Introducing Projects](https://cursor.com/blog/projects)

In research, I think much of this capability comes down to finding solutions. AI can search related work, combine approaches, implement them, and run experiments in pursuit of better results.

Finding solutions has traditionally faced two straightforward constraints. One is how many approaches we can explore: our time is limited, and reading across different fields to find useful combinations takes considerable effort. The other is compute: ideas need experiments, and trial and error has a cost.

AI makes searching and combining approaches easier. It can draw on a large body of relevant knowledge to identify promising directions, potentially reducing the number of experiments needed to find a good solution. Those experiments still require compute, but I think finding good solutions is becoming easier.

## More papers make research motivation more important

Submission counts at top conferences are also growing rapidly. ICLR's official figures show 11,603 submissions in 2025 and 19,525 in 2026, an increase of about 68.3%. [ICLR 2026 Fact Sheet](https://media.iclr.cc/Conferences/ICLR2026/ICLR2026_Fact_Sheet.pdf)

Using AI to help write papers and propose solutions feels natural to me. Many engineering papers in computer science are already about finding solutions. Having agents try many approaches and find better ones makes sense.

Papers also express something I consider more important: What do we care about? Why did we choose to do this research? Why is this problem worth solving?

We can take an existing paper, ask AI to find an improvement, run experiments, get a better result, and write another paper. That process may produce a good solution. It can also produce one before the person running it has developed a deep understanding of the problem.

That is why I care more about the central idea behind the research. As AI becomes better at finding solutions for us, we should give more thought to why we are doing the work and what values it reflects.

## Benchmarks define what we want to achieve

This reminds me of how we use agents in engineering: set a goal, provide success criteria, and let the agent work toward them.

Designing a benchmark is, in some sense, the same thing. We define the problem we want to solve and the conditions for success, then let agents search for solutions in that direction.

To me, the most important questions when designing a benchmark are: What does it measure? Why measure it this way? Why choose or design these metrics? What should the dataset contain to reflect the problem we want to address?

These choices express what matters to the people who actually work on the task and care about it.

That is why I see good benchmarks and evaluation protocols as more foundational work. They define the goals of the research and give the search for solutions a clear direction.

## Put scale to work on problems worth solving

Take speech recognition for people with speech impairments. We could have agents try all sorts of solutions to a specific problem, pushing the score a little higher with each improvement.

I think this kind of search will increasingly lend itself to scale: having agents explore a wider range of possibilities and try more approaches to find better solutions.

If everyone runs their own group of agents, finds a small improvement, and writes a paper about it, I wonder whether more of our research effort should go toward building useful benchmarks. I would like to see us define the goals first, then have large numbers of agents explore solutions toward those goals.

We will still want to understand the good solutions that emerge. In terms of research priorities, though, I think building more good benchmarks deserves more of our attention first.

## A perfect score should mean the problem is solved

These benchmarks can be small, each focused on a specific problem within a field. What matters is clearly defining what we care about, what the dataset should contain, and what the metrics should measure.

I want the purpose of a benchmark to be establishing whether the problem we care about has actually been solved. When designing one, we should think carefully about this question:

**When a system achieves a near-perfect or perfect score on this benchmark, does that mean the problem we care about has actually been solved?**
