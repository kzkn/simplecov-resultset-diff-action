require 'erb'
require 'bigdecimal'
require 'fileutils'
require 'pathname'

TEMPLATE = ERB.new(<<~ERB)
<svg xmlns="http://www.w3.org/2000/svg" width="60" height="20">
  <g font-family="&#39;DejaVu Sans&#39;,Verdana,Geneva,sans-serif" font-size="11">
    <path d="M0,0 L60,0 L60,20 L0,20 L0,0 Z" fill="<%= color %>" fill-rule="nonzero"></path>
    <text x="50%" text-anchor="middle" fill="#010101" fill-opacity=".3">
      <tspan y="15"><%= num %>%</tspan>
    </text>
    <text x="50%" text-anchor="middle" fill="#FFFFFF">
      <tspan y="14"><%= num %>%</tspan>
    </text>
  </g>
</svg>
ERB

def render_svg(num, color)
  TEMPLATE.result_with_hash({ num: num, color: color })
end

def generate_svg_file(num, color, filename)
  svg = render_svg(num, color)
  File.open(filename, 'w') do |f|
    f.write(svg)
  end
end

def svg_dirpath(sign, num)
  Pathname.new(__dir__).join("../assets/#{sign}/#{num.fix.to_i}")
end

def svg_filename(num)
  "#{num.truncate(1).to_f}.svg"
end

def prepare_svg_filename(sign, num)
  dir = svg_dirpath(sign, num)
  FileUtils.mkdir_p(dir)
  dir.join(svg_filename(num))
end

def generate(sign, color)
  sign_for_dir = sign == '+' ? 'up' : 'down'

  i = BigDecimal('0')
  step = BigDecimal('0.1')
  while i < 100
    i += step
    filename = prepare_svg_filename(sign_for_dir, i)
    generate_svg_file("#{sign}#{i.truncate(1).to_f}", color, filename)
  end
end

generate('+', '#34d058')
generate('-', '#c34349')
generate_svg_file('0', '#444D56', Pathname.new(__dir__).join("../assets/0.svg"))
