# Fences
Fences is a logic puzzle game played on an m-by-n grid of dots.

The dots are to be connected by vertical or horizontal lines so as to form a single loop. (That is, a solved puzzle is a Hamiltonian cycle on the box product of the paths of length m-1 and n-1.) In any given puzzle, some of the edges are pre-filled; these are the *clues*, and are intended to be included in the solution. 

# Your task
Your task is to create a solver for Fences puzzles. Your solver should include the following:
1. A large, interactive grid of customizable dimensions. Clues may be placed by clicking on the edges.
2. A live solving algorithm. That is, as clues are placed, the solver tries to find solutions live.
  - If there is one solution, it is prominently displayed on the grid.
  - If there are multiple solutions, they are indicated with a heat map; that is, edges are highlighted to the extent that they appear in solutions found so far.
  - If there are many solutions, the algorithm displays the heatmap of the solutions found so far as it seeks additional ones. It is indicated to the user that solutions are still being sought, and the number of solutions found so far.
  - The live solve may be paused or resumed by the user.
3. An option to randomly place clues on the grid. The user can either (a) specify a number of clues to be roughly evenly distributed on the grid; or (b) specify a density between 0% and 100%, to which the board should be approximately filled. In either case, vertical and horizontal lines should appear with roughly the same frequency.
4. QoL options like clearing the grid, stopping the solve altogether, etc.

# Fences+ (upgrade)
Fences+ adds a second clue type: *indoors / outdoors dots*, placed within any square cell of the grid. An indoors dot (filled circle) means the cell lies inside the fenced region in the finished puzzle; an outdoors dot (unfilled circle) means it lies outside. Clicking the center of a cell cycles it through "no dot", "indoors dot", "outdoors dot". The solver accounts for these clues.

# Style considerations
Your template for the style of the solver is the interactive Sudoku solver found at the following site: https://sigh.github.io/Interactive-Sudoku-Solver/
You should, however, use warmer colors, and support a dark theme. Everything should be easily legible.

