import{i as e}from"./preload-helper-BdFrVu1K.js";import{t}from"./jsx-runtime-f3rHp9ZU.js";import{n,t as r}from"./badge-Cs5YhrRx.js";var i,a,o,s,c,l;e((()=>{n(),i=t(),a={title:`Shared UI/Badge`,component:r,args:{children:`Monitoring`,tone:`neutral`},argTypes:{tone:{control:`inline-radio`,options:[`neutral`,`info`,`success`,`warning`,`danger`]}}},o={},s={args:{children:`Critical Incident`,tone:`danger`},argTypes:{children:{control:`text`,description:`Badge 안에 표시할 문구`},tone:{control:`inline-radio`,options:[`neutral`,`info`,`success`,`warning`,`danger`],description:`Badge의 의미와 색상`}}},c={decorators:[e=>(0,i.jsx)(`div`,{style:{background:`#ffffff`,padding:`2rem`},children:(0,i.jsx)(e,{})})],render:()=>(0,i.jsxs)(`div`,{style:{display:`flex`,gap:`0.75rem`,flexWrap:`wrap`},children:[(0,i.jsx)(r,{tone:`neutral`,children:`Neutral`}),(0,i.jsx)(r,{tone:`info`,children:`Info`}),(0,i.jsx)(r,{tone:`success`,children:`Success`}),(0,i.jsx)(r,{tone:`warning`,children:`Warning`}),(0,i.jsx)(r,{tone:`danger`,children:`Danger`})]})},o.parameters={...o.parameters,docs:{...o.parameters?.docs,source:{originalSource:`{}`,...o.parameters?.docs?.source}}},s.parameters={...s.parameters,docs:{...s.parameters?.docs,source:{originalSource:`{
  args: {
    children: "Critical Incident",
    tone: "danger"
  },
  argTypes: {
    children: {
      control: "text",
      description: "Badge 안에 표시할 문구"
    },
    tone: {
      control: "inline-radio",
      options: ["neutral", "info", "success", "warning", "danger"],
      description: "Badge의 의미와 색상"
    }
  }
}`,...s.parameters?.docs?.source}}},c.parameters={...c.parameters,docs:{...c.parameters?.docs,source:{originalSource:`{
  decorators: [Story => <div style={{
    background: "#ffffff",
    padding: "2rem"
  }}>\r
        <Story />\r
      </div>],
  render: () => <div style={{
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap"
  }}>\r
      <Badge tone="neutral">Neutral</Badge>\r
      <Badge tone="info">Info</Badge>\r
      <Badge tone="success">Success</Badge>\r
      <Badge tone="warning">Warning</Badge>\r
      <Badge tone="danger">Danger</Badge>\r
    </div>
}`,...c.parameters?.docs?.source}}},l=[`Playground`,`CriticalIncident`,`Tones`]}))();export{s as CriticalIncident,o as Playground,c as Tones,l as __namedExportsOrder,a as default};